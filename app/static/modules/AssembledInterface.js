import { CONFIG } from './config.js';
import CanvasState from './CanvasState.js';
import DraggableImage from './DraggableImage.js';
import GridRenderer from './GridRenderer.js';
import PaintManager from './PaintManager.js';
import Events from './Events.js';
import { CanvasFactory } from './utils/CanvasFactory.js';
import { MaskPreviewManager } from './utils/MaskPreviewManager.js';
import { ImageImportManager } from './utils/ImageImportManager.js';
import { Mask } from './Mask.js';

class AssembledInterface extends CanvasState {
    constructor(canvasId) {
        super(canvasId);
        this.gridRenderer = new GridRenderer(this);
        this.images = [];
        this.draggedImage = null;
        this.dragOffset = { x: 0, y: 0 };
        this.paintManager = new PaintManager(this);
        this.currentTool = 'move';
        this.originalConfig = null;
        this.currentMode = 'inpaint';
        this.isDraggingMask = false;
        this.events = new Events();
        this.maskPreviewManager = new MaskPreviewManager(this, this.events);
        this.imageImportManager = new ImageImportManager(this);

        // Setup socket event listeners
        this.setupSocketListeners();

        this.setupToolSelection();
        this.setupPreviewButton();
        this.setupModeSelection();
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

    setupSocketListeners() {
        // Handle mask export response
        this.events.socket.on('mask_export_response', (data) => {
            console.log('Received mask_export_response:', data);
            if (data.success) {
                // Show success message
                const message = document.createElement('div');
                message.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--shade-800);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 4px;
                    z-index: 1000;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                `;
                message.textContent = `Saved:\n- Mask: mask_outputs/${data.mask_filename}\n- Source: source_outputs/${data.source_filename}`;
                message.style.whiteSpace = 'pre-line';
                document.body.appendChild(message);
                
                // Remove message after 3 seconds
                setTimeout(() => {
                    document.body.removeChild(message);
                }, 3000);
            } else {
                console.error('Mask export failed:', data);
            }
        });
    }

    setupPreviewButton() {
        const exportButton = document.getElementById('export-operation');
        exportButton.addEventListener('click', async () => {
            if (this.images.length === 0) return;

            const image = this.images[this.images.length - 1];
            let maskCanvas;

            if (this.currentMode === 'outpaint' && image.outpaintMask) {
                // For outpaint mode, use the outpaint mask
                const mask = image.outpaintMask;
                maskCanvas = mask.getMaskCanvas();
            } else {
                // For inpaint mode, use Mask directly
                maskCanvas = Mask.renderInpaintMask(image.image, image.paintCanvas);
            }

            // Get current blur radius
            const blurRadius = parseInt(document.getElementById('blurRadius').value);

            // Convert mask canvas to base64 PNG
            const maskPngData = maskCanvas.toDataURL('image/png');
            
            // Prepare source image based on mode
            let sourceImageData;
            if (this.currentMode === 'outpaint' && image.outpaintMask) {
                // For outpaint, create image on gray background matching mask size
                const mask = image.outpaintMask;
                const extendedWidth = image.width + mask.extends.left + mask.extends.right;
                const extendedHeight = image.height + mask.extends.top + mask.extends.bottom;
                
                const sourceCanvas = CanvasFactory.createImageOnGrayBackground(
                    image.image,
                    extendedWidth,
                    extendedHeight,
                    mask.extends.left,
                    mask.extends.top
                );
                sourceImageData = sourceCanvas.toDataURL('image/png');
            } else {
                // For inpaint, use original image directly
                sourceImageData = image.image.src;
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportData = {
                mask: maskPngData,
                sourceImage: sourceImageData,
                mode: this.currentMode,
                blurRadius: blurRadius,
                timestamp: timestamp
            };
            console.log("Sending mask_export event with data:", Object.keys(exportData));
            
            // Show loading indicator
            const loadingMessage = document.createElement('div');
            loadingMessage.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--shade-800);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
            loadingMessage.textContent = 'Saving images...';
            document.body.appendChild(loadingMessage);

            try {
                await this.events.emit('mask_export', exportData);
            } catch (error) {
                console.error('Failed to export mask:', error);
                // Error is already shown by Events class
            } finally {
                document.body.removeChild(loadingMessage);
            }
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
        // Clear the entire canvas and set background
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        this.ctx.fillStyle = CONFIG.CANVAS.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply main transform for world space
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.originX, this.originY);

        // Draw grid
        this.ctx.save();
        this.gridRenderer.draw();
        this.ctx.restore();
        
        // Draw images and masks
        this.images.forEach(img => {
            this.ctx.save();
            
            // Draw the base image
            this.ctx.drawImage(img.image, img.x, img.y, img.width, img.height);
            
            // Handle mask preview
            if (this.maskPreviewManager.isPreviewActive() && this.maskPreviewManager.getPreviewImage()) {
                if (this.currentMode === 'inpaint') {
                    this.ctx.drawImage(this.maskPreviewManager.getPreviewImage(), img.x, img.y);
                } else if (img.outpaintMask) {
                    this.ctx.drawImage(
                        this.maskPreviewManager.getPreviewImage(),
                        img.x - img.outpaintMask.extends.left,
                        img.y - img.outpaintMask.extends.top,
                        img.width + img.outpaintMask.extends.left + img.outpaintMask.extends.right,
                        img.height + img.outpaintMask.extends.top + img.outpaintMask.extends.bottom
                    );
                }
            } else if (!this.maskPreviewManager.isPreviewActive()) {
                // Normal painting mode
                if (this.currentMode === 'inpaint') {
                    // Draw paint background
                    this.ctx.save();
                    CanvasFactory.setupCanvasContext(this.ctx, {
                        globalAlpha: CONFIG.PAINT.BACKGROUND.OPACITY,
                        fillStyle: CONFIG.PAINT.BACKGROUND.COLOR
                    });
                    this.ctx.fillRect(img.x, img.y, img.width, img.height);
                    this.ctx.restore();
                    
                    // Draw paint strokes
                    this.ctx.save();
                    CanvasFactory.setupCanvasContext(this.ctx, {
                        globalAlpha: CONFIG.PAINT.BRUSH.OPACITY,
                        fillStyle: CONFIG.PAINT.BRUSH.COLOR
                    });
                    this.ctx.drawImage(img.paintCanvas, img.x, img.y);
                    this.ctx.restore();
                } else if (img.outpaintMask) {
                    img.outpaintMask.draw(this.ctx);
                }
            }
            
            img.drawCoordinates(this.ctx);
            this.ctx.restore();
        });
    }
}

const canvas = new AssembledInterface('canvas');