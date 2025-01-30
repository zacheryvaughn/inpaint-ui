import { CONFIG } from './config.js';
import { CanvasFactory } from './utils/CanvasFactory.js';
import { CoordinateSystem } from './utils/CoordinateSystem.js';

export class Mask {
    // Static methods for mask operations
    static createMaskCanvas(width, height) {
        return CanvasFactory.createCanvas(width, height);
    }

    static renderInpaintMask(sourceImage, paintCanvas) {
        const { canvas: previewCanvas, ctx: previewCtx } = this.createMaskCanvas(
            sourceImage.naturalWidth,
            sourceImage.naturalHeight
        );

        const { canvas: whiteCanvas, ctx: whiteCtx } = this.createMaskCanvas(
            sourceImage.naturalWidth,
            sourceImage.naturalHeight
        );

        // Draw the paint canvas onto the white canvas
        whiteCtx.drawImage(paintCanvas, 0, 0, sourceImage.naturalWidth, sourceImage.naturalHeight);

        // Fill the painted areas with white
        whiteCtx.globalCompositeOperation = 'source-in';
        whiteCtx.fillStyle = '#FFFFFF';
        whiteCtx.fillRect(0, 0, sourceImage.naturalWidth, sourceImage.naturalHeight);

        // Fill the preview canvas with black
        previewCtx.fillStyle = '#000000';
        previewCtx.fillRect(0, 0, sourceImage.naturalWidth, sourceImage.naturalHeight);

        // Draw the white mask onto the preview canvas
        previewCtx.drawImage(whiteCanvas, 0, 0);

        return previewCanvas;
    }

    static renderOutpaintMask(width, height, extends_, overlap) {
        const { canvas, ctx } = this.createMaskCanvas(width, height);

        // Fill everything with black (masked area)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Draw the outpaint areas in white
        ctx.fillStyle = '#FFFFFF';

        const overlaps = {
            left: extends_.left > 0 ? overlap : 0,
            right: extends_.right > 0 ? overlap : 0,
            top: extends_.top > 0 ? overlap : 0,
            bottom: extends_.bottom > 0 ? overlap : 0
        };

        if (extends_.left > 0) {
            ctx.fillRect(0, 0, extends_.left + overlaps.left, height);
        }

        if (extends_.right > 0) {
            ctx.fillRect(
                width - extends_.right - overlaps.right, 0,
                extends_.right + overlaps.right, height
            );
        }

        if (extends_.top > 0) {
            ctx.fillRect(0, 0, width, extends_.top + overlaps.top);
        }

        if (extends_.bottom > 0) {
            ctx.fillRect(
                0, height - extends_.bottom - overlaps.bottom,
                width, extends_.bottom + overlaps.bottom
            );
        }

        return canvas;
    }

    static drawOutpaintBounds(ctx, image, extends_, scale) {
        ctx.save();
        
        // Draw outer bounds
        ctx.strokeStyle = 'rgba(17, 187, 238, 0.8)';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([4 / scale]);
        
        ctx.strokeRect(
            image.x - extends_.left,
            image.y - extends_.top,
            image.width + extends_.left + extends_.right,
            image.height + extends_.top + extends_.bottom
        );

        // Draw overlap bounds if needed
        if (image.maskOverlap > 0) {
            ctx.strokeStyle = 'rgba(17, 187, 238, 0.4)';
            const overlaps = {
                left: extends_.left > 0 ? image.maskOverlap : 0,
                right: extends_.right > 0 ? image.maskOverlap : 0,
                top: extends_.top > 0 ? image.maskOverlap : 0,
                bottom: extends_.bottom > 0 ? image.maskOverlap : 0
            };

            if (extends_.left > 0 || extends_.right > 0 || 
                extends_.top > 0 || extends_.bottom > 0) {
                
                const x = image.x + (extends_.left > 0 ? overlaps.left : 0);
                const y = image.y + (extends_.top > 0 ? overlaps.top : 0);
                const w = image.width - (overlaps.left + overlaps.right);
                const h = image.height - (overlaps.top + overlaps.bottom);
                
                ctx.strokeRect(x, y, w, h);
            }
        }
        
        ctx.restore();
    }

    static constrainExtension(size) {
        return Math.min(
            Math.max(size, CONFIG.OUTPAINT.MIN_SIZE),
            CONFIG.OUTPAINT.MAX_SIZE
        );
    }

    // Instance methods for outpaint mask management
    constructor(image, canvasState) {
        this.image = image;
        this.canvasState = canvasState;
        this.maskOverlap = CONFIG.OUTPAINT.DEFAULT_OVERLAP;
        
        this.extends = {
            top: CONFIG.OUTPAINT.MIN_SIZE,
            right: CONFIG.OUTPAINT.MIN_SIZE,
            bottom: CONFIG.OUTPAINT.MIN_SIZE,
            left: CONFIG.OUTPAINT.MIN_SIZE
        };
        
        this.isDragging = false;
        this.dragEdge = null;
        this.dragStart = null;
        
        const { canvas, ctx } = CanvasFactory.createCanvas();
        this.canvas = canvas;
        this.ctx = ctx;
        
        this.updateCanvasSize();
        this.setupControls();
    }

    setupControls() {
        const overlapSlider = document.getElementById('maskOverlap');
        if (overlapSlider) {
            overlapSlider.min = CONFIG.OUTPAINT.MIN_OVERLAP;
            overlapSlider.max = CONFIG.OUTPAINT.MAX_OVERLAP;
            overlapSlider.value = CONFIG.OUTPAINT.DEFAULT_OVERLAP;
            
            overlapSlider.addEventListener('input', (e) => {
                this.maskOverlap = Math.min(
                    Math.max(
                        parseInt(e.target.value),
                        CONFIG.OUTPAINT.MIN_OVERLAP
                    ),
                    CONFIG.OUTPAINT.MAX_OVERLAP
                );
                document.getElementById('maskOverlapValue').textContent = this.maskOverlap;
                this.updateCanvasSize();
                this.canvasState.scheduleRedraw();
            });
        }
    }

    handleMouseDown(e) {
        if (e.button !== 0) return false;
    
        const edge = this.getHoveredEdge(e);
        if (edge) {
            this.isDragging = true;
            this.dragEdge = edge;
            this.dragStart = CoordinateSystem.worldToCanvas(e.clientX, e.clientY, this.canvasState);
            return true;
        }
        return false;
    }

    handleMouseMove(e) {
        if (!this.isDragging) {
            const edge = this.getHoveredEdge(e);
            if (edge) {
                switch(edge) {
                    case 'left':
                    case 'right':
                        this.canvasState.canvas.style.cursor = 'ew-resize';
                        break;
                    case 'top':
                    case 'bottom':
                        this.canvasState.canvas.style.cursor = 'ns-resize';
                        break;
                }
            } else {
                this.canvasState.canvas.style.cursor = 'default';
            }
            return;
        }
    
        const currentPos = CoordinateSystem.worldToCanvas(e.clientX, e.clientY, this.canvasState);
    
        switch(this.dragEdge) {
            case 'left': {
                const extension = Math.max(0, this.image.x - currentPos.x);
                this.extends.left = this.snapExtensionToGrid(extension);
                break;
            }
            case 'right': {
                const extension = Math.max(0, currentPos.x - (this.image.x + this.image.width));
                this.extends.right = this.snapExtensionToGrid(extension);
                break;
            }
            case 'top': {
                const extension = Math.max(0, this.image.y - currentPos.y);
                this.extends.top = this.snapExtensionToGrid(extension);
                break;
            }
            case 'bottom': {
                const extension = Math.max(0, currentPos.y - (this.image.y + this.image.height));
                this.extends.bottom = this.snapExtensionToGrid(extension);
                break;
            }
        }
    
        this.updateCanvasSize();
        this.canvasState.scheduleRedraw();
    }

    snapExtensionToGrid(extension) {
        return Mask.constrainExtension(
            Math.round(extension / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE
        );
    }

    handleMouseUp() {
        this.isDragging = false;
        this.dragEdge = null;
        this.dragStart = null;
        this.canvasState.canvas.style.cursor = 'default';
    }

    getHoveredEdge(e) {
        const coords = CoordinateSystem.worldToCanvas(e.clientX, e.clientY, this.canvasState);
        const edgeThreshold = 10 / this.canvasState.scale;
    
        const bounds = {
            left: this.image.x - this.extends.left,
            right: this.image.x + this.image.width + this.extends.right,
            top: this.image.y - this.extends.top,
            bottom: this.image.y + this.image.height + this.extends.bottom
        };
    
        const withinVerticalBounds = coords.y >= bounds.top && coords.y <= bounds.bottom;
        const withinHorizontalBounds = coords.x >= bounds.left && coords.x <= bounds.right;
    
        if (Math.abs(coords.x - bounds.left) < edgeThreshold && withinVerticalBounds) {
            return 'left';
        }
        if (Math.abs(coords.x - bounds.right) < edgeThreshold && withinVerticalBounds) {
            return 'right';
        }
        if (Math.abs(coords.y - bounds.top) < edgeThreshold && withinHorizontalBounds) {
            return 'top';
        }
        if (Math.abs(coords.y - bounds.bottom) < edgeThreshold && withinHorizontalBounds) {
            return 'bottom';
        }
    
        return null;
    }

    updateCanvasSize() {
        if (!this.image.isLoaded) return;
        
        const width = this.image.width + this.extends.left + this.extends.right;
        const height = this.image.height + this.extends.top + this.extends.bottom;
        
        this.canvas = Mask.renderOutpaintMask(
            width,
            height,
            this.extends,
            this.maskOverlap
        );
    }
    
    draw(ctx) {
        if (!this.image.isLoaded) return;
        
        Mask.drawOutpaintBounds(ctx, this.image, this.extends, this.canvasState.scale);
    
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BACKGROUND.OPACITY;
        ctx.fillStyle = CONFIG.PAINT.BACKGROUND.COLOR;
        ctx.fillRect(
            this.image.x - this.extends.left,
            this.image.y - this.extends.top,
            this.image.width + this.extends.left + this.extends.right,
            this.image.height + this.extends.top + this.extends.bottom
        );
        ctx.restore();
    
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BRUSH.OPACITY;
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    
        if (this.extends.left > 0 || this.extends.right > 0 || 
            this.extends.top > 0 || this.extends.bottom > 0) {
            
            const overlaps = {
                left: this.extends.left > 0 ? this.maskOverlap : 0,
                right: this.extends.right > 0 ? this.maskOverlap : 0,
                top: this.extends.top > 0 ? this.maskOverlap : 0,
                bottom: this.extends.bottom > 0 ? this.maskOverlap : 0
            };
            
            ctx.beginPath();
            
            ctx.rect(
                this.image.x - this.extends.left,
                this.image.y - this.extends.top,
                this.image.width + this.extends.left + this.extends.right,
                this.image.height + this.extends.top + this.extends.bottom
            );
            
            ctx.rect(
                this.image.x + overlaps.left,
                this.image.y + overlaps.top,
                this.image.width - (overlaps.left + overlaps.right),
                this.image.height - (overlaps.top + overlaps.bottom)
            );
            
            ctx.fill('evenodd');
        }
    
        ctx.restore();
    }

    getMaskCanvas() {
        this.updateCanvasSize();
        return this.canvas;
    }
}