import { CONFIG } from './config.js';
import CanvasState from './CanvasState.js';
import DraggableImage from './DraggableImage.js';
import GridRenderer from './GridRenderer.js';
import MaskRenderer from './MaskRenderer.js';
import PaintManager from './PaintManager.js';
import Events from './Events.js';

class AssembledInterface extends CanvasState {
    constructor(canvasId) {
        super(canvasId);
        this.gridRenderer = new GridRenderer(this);
        this.images = [];
        this.draggedImage = null;
        this.dragOffset = { x: 0, y: 0 };
        this.paintManager = new PaintManager(this);
        this.currentTool = 'move';
        this.isPreviewingMask = false;
        this.originalConfig = null;
        this.currentMode = 'inpaint';
        this.isDraggingMask = false;
        this.events = new Events();

        this.setupImageImport();
        this.setupToolSelection();
        this.setupPreviewButton();
        this.setupModeSelection();
    }

    setupImageImport() {
        const importButton = document.getElementById('import-operation');
        const imageInput = document.getElementById('imageInput');
        
        importButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        // Calculate dimensions that are divisible by 8
                        const newWidth = Math.floor(img.naturalWidth / 8) * 8;
                        const newHeight = Math.floor(img.naturalHeight / 8) * 8;
                        
                        // Create a temporary canvas for cropping
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = newWidth;
                        tempCanvas.height = newHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        // Draw the image centered in the new dimensions
                        tempCtx.drawImage(img, 
                            0, 0, img.naturalWidth, img.naturalHeight,  // Source rect
                            0, 0, newWidth, newHeight                   // Dest rect
                        );
                        
                        // Convert the cropped canvas to a data URL
                        const croppedImageUrl = tempCanvas.toDataURL('image/png');
                        
                        // Create new DraggableImage with the cropped image
                        const newImage = new DraggableImage(croppedImageUrl, this);
                        newImage.setMode(this.currentMode);
                        this.images.push(newImage);
                        this.scheduleRedraw();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
                imageInput.value = '';
            }
        });
    }

    handleImageImport(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(file);
            const newImage = new DraggableImage(imageUrl, this);
            this.images.push(newImage);
            this.scheduleRedraw();
            e.target.value = '';
        }
    }

    setupModeSelection() {
        const modeSelect = document.getElementById('paint-mode');
        const outpaintControls = document.getElementById('outpaint-controls');
        const paintTools = document.querySelectorAll('#paint-tool, #eraser-tool');

        modeSelect.addEventListener('change', async (e) => {
            const newMode = e.target.value;
            
            // If there are any unsaved changes, show warning
            if (this.hasUnsavedChanges()) {
                const confirmed = await this.showModeChangeWarning();
                if (!confirmed) {
                    modeSelect.value = this.currentMode;
                    return;
                }
            }

            this.currentMode = newMode;
            
            // Update UI visibility
            if (newMode === 'outpaint') {
                outpaintControls.style.display = 'flex';
                paintTools.forEach(tool => tool.style.display = 'none');
                // Force move tool when in outpaint mode
                this.updateToolSelection('move', {
                    move: document.getElementById('move-tool'),
                    paint: document.getElementById('paint-tool'),
                    eraser: document.getElementById('eraser-tool')
                });
            } else {
                outpaintControls.style.display = 'none';
                paintTools.forEach(tool => tool.style.display = 'flex');
            }

            // Update current image mode
            if (this.images.length > 0) {
                const currentImage = this.images[this.images.length - 1];
                currentImage.setMode(newMode);
                // Clear any existing paint/mask data
                this.clearMaskData();
            }

            this.scheduleRedraw();
        });
    }

    hasUnsavedChanges() {
        if (this.images.length === 0) return false;
        
        const currentImage = this.images[this.images.length - 1];
        if (this.currentMode === 'inpaint') {
            // Check if paint canvas has any content
            const imageData = currentImage.paintCtx.getImageData(
                0, 0, 
                currentImage.paintCanvas.width, 
                currentImage.paintCanvas.height
            );
            return imageData.data.some(pixel => pixel !== 0);
        }
        // For outpaint mode, we always consider it has changes if the mask exists
        return true;
    }

    showModeChangeWarning() {
        return new Promise((resolve) => {
            const warningDialog = document.createElement('div');
            warningDialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--shade-800);
                padding: 20px;
                border-radius: 8px;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                min-width: 300px;
            `;

            warningDialog.innerHTML = `
                <h3 style="margin-bottom: 16px;">Warning</h3>
                <p style="margin-bottom: 20px;">Changing modes will clear your current work. Are you sure you want to continue?</p>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancel-mode-change" class="dialog-button" style="background: var(--shade-700);">Cancel</button>
                    <button id="confirm-mode-change" class="dialog-button" style="background: var(--error-red);">Continue</button>
                </div>
            `;

            document.body.appendChild(warningDialog);

            const handleResponse = (confirmed) => {
                document.body.removeChild(warningDialog);
                resolve(confirmed);
            };

            document.getElementById('cancel-mode-change').onclick = () => handleResponse(false);
            document.getElementById('confirm-mode-change').onclick = () => handleResponse(true);
        });
    }

    clearMaskData() {
        if (this.images.length === 0) return;
        
        const currentImage = this.images[this.images.length - 1];
        currentImage.paintCtx.clearRect(
            0, 0,
            currentImage.paintCanvas.width,
            currentImage.paintCanvas.height
        );
    }

    setupToolSelection() {
        const tools = ['move', 'paint', 'eraser'];
        const buttons = tools.reduce((acc, tool) => {
            acc[tool] = document.getElementById(`${tool}-tool`);
            return acc;
        }, {});

        buttons.move.classList.add('selected');
        tools.forEach(tool => {
            buttons[tool].addEventListener('click', () => {
                this.updateToolSelection(tool, buttons);
            });
        });
    }

    updateToolSelection(selectedTool, buttons) {
        Object.values(buttons).forEach(button => button.classList.remove('selected'));
        buttons[selectedTool].classList.add('selected');
        this.currentTool = selectedTool;
        this.paintManager.setTool(selectedTool);
    }

    setupPreviewButton() {
        // Setup blur radius slider
        const blurRadiusSlider = document.getElementById('blurRadius');
        const blurRadiusValue = document.getElementById('blurRadiusValue');
        
        blurRadiusSlider.addEventListener('input', (e) => {
            blurRadiusValue.textContent = e.target.value;
        });

        const previewButton = document.getElementById('preview-mask');
        previewButton.addEventListener('click', () => {
            if (this.images.length === 0) return;

            const image = this.images[this.images.length - 1];
            let maskCanvas;

            if (this.currentMode === 'outpaint' && image.outpaintMask) {
                // For outpaint mode, use the outpaint mask
                const mask = image.outpaintMask;
                maskCanvas = mask.getMaskCanvas();
            } else {
                // For inpaint mode, use the existing mask renderer
                const maskRenderer = new MaskRenderer();
                maskCanvas = maskRenderer.renderMask(image.image, image.paintCanvas);
            }

            // Get current blur radius
            const blurRadius = parseInt(blurRadiusSlider.value);

            // Convert canvas to base64 PNG and send via socket
            const maskPngData = maskCanvas.toDataURL('image/png');
            this.events.socket.emit('mask_preview', {
                mask: maskPngData,
                mode: this.currentMode,
                blurRadius: blurRadius
            });
        });

        const exportButton = document.getElementById('export-operation');
        exportButton.addEventListener('click', () => {
            if (this.images.length === 0) return;

            const image = this.images[this.images.length - 1];
            let maskCanvas;

            if (this.currentMode === 'outpaint' && image.outpaintMask) {
                // For outpaint mode, use the outpaint mask
                const mask = image.outpaintMask;
                maskCanvas = mask.getMaskCanvas();
            } else {
                // For inpaint mode, use the existing mask renderer
                const maskRenderer = new MaskRenderer();
                maskCanvas = maskRenderer.renderMask(image.image, image.paintCanvas);
            }

            // Get current blur radius
            const blurRadius = parseInt(blurRadiusSlider.value);

            // Convert canvas to base64 PNG and send via socket
            const maskPngData = maskCanvas.toDataURL('image/png');
            this.events.socket.emit('mask_export', {
                mask: maskPngData,
                mode: this.currentMode,
                blurRadius: blurRadius
            });
        });
    }

    handleMouseDown(e) {
        // First check if we're in outpaint mode and trying to drag the mask
        if (this.currentMode === 'outpaint' && this.images.length > 0) {
            const currentImage = this.images[this.images.length - 1];
            if (currentImage.outpaintMask && currentImage.outpaintMask.handleMouseDown(e)) {
                this.isDraggingMask = true;
                return;
            }
        }

        // If not dragging mask, handle other mouse down events
        if (this.currentMode === 'inpaint' && 
            (this.currentTool === 'paint' || this.currentTool === 'eraser') && 
            e.button === 0) {
            this.paintManager.startPainting(e);
        } else if (e.button === 2) {
            this.startPanning(e);
        } else if (e.button === 0 && this.currentTool === 'move') {
            this.startDraggingImage(e);
        } else if (e.button === 1) {
            e.preventDefault();
            this.centerOrigin();
            this.scheduleRedraw();
        }
    }

    handleMouseMove(e) {
        // Handle mask dragging
        if (this.isDraggingMask && this.images.length > 0) {
            const currentImage = this.images[this.images.length - 1];
            currentImage.outpaintMask.handleMouseMove(e);
            return;
        }

        // Handle other mouse move events
        if (this.isPanning) {
            this.updatePanning(e);
        } else if (this.draggedImage && this.currentTool === 'move') {
            this.updateImageDrag(e);
        } else if (this.paintManager.isPainting) {
            this.paintManager.paint(e);
        } else if (this.currentMode === 'outpaint' && this.images.length > 0) {
            // Update cursor when hovering over mask edges
            const currentImage = this.images[this.images.length - 1];
            currentImage.outpaintMask.handleMouseMove(e);
        }
    }

    handleMouseUp(e) {
        if (this.isDraggingMask) {
            const currentImage = this.images[this.images.length - 1];
            currentImage.outpaintMask.handleMouseUp();
            this.isDraggingMask = false;
            return;
        }

        if (e.button === 2 && this.isPanning) {
            this.isPanning = false;
            this.paintManager.updateCursor();
        } else if (e.button === 0) {
            if (this.draggedImage) {
                this.draggedImage.isDragging = false;
                this.draggedImage = null;
                this.paintManager.updateCursor();
            }
            if (this.paintManager.isPainting) {
                this.paintManager.stopPainting();
            }
        }
    }

    handleMouseOut() {
        if (this.isDraggingMask) {
            const currentImage = this.images[this.images.length - 1];
            currentImage.outpaintMask.handleMouseUp();
            this.isDraggingMask = false;
        }

        if (this.isPanning) {
            this.isPanning = false;
            this.paintManager.updateCursor();
        }
        if (this.draggedImage) {
            this.draggedImage.isDragging = false;
            this.draggedImage = null;
            this.paintManager.updateCursor();
        }
        if (this.paintManager.isPainting) {
            this.paintManager.stopPainting();
        }
    }

    startPanning(e) {
        this.isPanning = true;
        this.dragOffset = {
            x: e.clientX * this.pixelRatio - this.originX,
            y: e.clientY * this.pixelRatio - this.originY
        };
        this.canvas.style.cursor = 'grabbing';
    }

    updatePanning(e) {
        if (!this.isPanning) return;
        
        this.originX = e.clientX * this.pixelRatio - this.dragOffset.x;
        this.originY = e.clientY * this.pixelRatio - this.dragOffset.y;
        this.scheduleRedraw();
    }

    startDraggingImage(e) {
        const coords = this.getWorldCoordinates(e.clientX, e.clientY);
        
        for (let i = this.images.length - 1; i >= 0; i--) {
            const img = this.images[i];
            if (img.containsPoint(coords.x, coords.y)) {
                this.draggedImage = img;
                this.dragOffset = {
                    x: coords.x - img.x,
                    y: coords.y - img.y
                };

                img.isDragging = true;
                this.images.splice(i, 1);
                this.images.push(img);
                this.canvas.style.cursor = 'grabbing';
                break;
            }
        }
    }

    updateImageDrag(e) {
        if (!this.draggedImage) return;
        const coords = this.getWorldCoordinates(e.clientX, e.clientY);
        this.draggedImage.x = coords.x - this.dragOffset.x;
        this.draggedImage.y = coords.y - this.dragOffset.y;
        this.draggedImage.snapToGrid();
        this.scheduleRedraw();
    }

    draw() {
        this.ctx.fillStyle = CONFIG.CANVAS.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.originX, this.originY);
        this.gridRenderer.draw();
        this.images.forEach(img => img.draw(this.ctx));
        this.ctx.restore();
    }
}

const canvas = new AssembledInterface('canvas');