import { CONFIG } from '../config.js';
import { CanvasState } from './CanvasState.js';
import { DraggableImage } from './DraggableImage.js';
import { GridRenderer } from './GridRenderer.js';
import { MaskRenderer } from './MaskRenderer.js';
import { PaintManager } from './PaintManager.js';

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
        this.originalConfig = null;  // Store original config values
        
        this.setupImageImport();
        this.setupToolSelection();
        this.setupPreviewButton();  // Add this line
    }

    setupImageImport() {
        const importButton = document.getElementById('import-operation');
        const imageInput = document.getElementById('imageInput');
    
        importButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', this.handleImageImport.bind(this));
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

    // Add this new method
    setupPreviewButton() {
        const previewButton = document.getElementById('preview-mask');
        previewButton.addEventListener('mousedown', () => {
            // Store original values
            this.originalConfig = {
                backgroundOpacity: CONFIG.PAINT.BACKGROUND.OPACITY,
                brushOpacity: CONFIG.PAINT.BRUSH.OPACITY,
                brushColor: CONFIG.PAINT.BRUSH.COLOR,
                backgroundColor: CONFIG.PAINT.BACKGROUND.COLOR
            };
            
            // Set preview values
            CONFIG.PAINT.BACKGROUND.OPACITY = 1.0;
            CONFIG.PAINT.BRUSH.OPACITY = 1.0;
            CONFIG.PAINT.BRUSH.COLOR = '#FFFFFF';
            CONFIG.PAINT.BACKGROUND.COLOR = '#000000';
            
            this.isPreviewingMask = true;
            this.scheduleRedraw();
        });
        
        const resetPreview = () => {
            if (this.originalConfig) {
                // Restore original values
                CONFIG.PAINT.BACKGROUND.OPACITY = this.originalConfig.backgroundOpacity;
                CONFIG.PAINT.BRUSH.OPACITY = this.originalConfig.brushOpacity;
                CONFIG.PAINT.BRUSH.COLOR = this.originalConfig.brushColor;
                CONFIG.PAINT.BACKGROUND.COLOR = this.originalConfig.backgroundColor;
                this.originalConfig = null;
            }
            this.isPreviewingMask = false;
            this.scheduleRedraw();
        };
        
        previewButton.addEventListener('mouseup', resetPreview);
        previewButton.addEventListener('mouseleave', resetPreview);

        // Setup export button
        const exportButton = document.getElementById('export-operation');
        exportButton.addEventListener('click', () => {
            if (this.images.length === 0) return;
            
            const image = this.images[this.images.length - 1];
            
            // Use MaskRenderer to create the mask
            const maskRenderer = new MaskRenderer();
            const exportCanvas = maskRenderer.renderMask(image.image, image.paintCanvas);
        
            // Convert to PNG and download
            const link = document.createElement('a');
            link.download = 'mask.png';
            link.href = exportCanvas.toDataURL('image/png');
            link.click();
        });
    }

    handleMouseDown(e) {
        if ((this.currentTool === 'paint' || this.currentTool === 'eraser') && e.button === 0) {
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
        if (this.isPanning) {
            this.updatePanning(e);
        } else if (this.draggedImage && this.currentTool === 'move') {
            this.updateImageDrag(e);
        } else if (this.paintManager.isPainting) {
            this.paintManager.paint(e);
        }
    }

    handleMouseUp(e) {
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
                
                // Move image to top
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