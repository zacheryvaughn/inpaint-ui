import { CONFIG } from './config.js';
import { CanvasFactory } from './utils/CanvasFactory.js';
import { CoordinateSystem } from './utils/CoordinateSystem.js';
import { Mask } from './Mask.js';

export default class DraggableImage {
    constructor(imageUrl, canvasState) {
        this.x = 0;
        this.y = 0;
        this.isDragging = false;
        this.isLoaded = false;
        this.canvasState = canvasState;
        this.currentMode = 'inpaint';
        
        this.setupImage(imageUrl);
        this.setupCanvases();
        this.outpaintMask = null;
    }

    setupImage(imageUrl) {
        this.image = new Image();
        this.image.src = imageUrl;
        this.image.onload = () => this.handleImageLoad();
    }

    setupCanvases() {
        // Create canvases with initial dimensions
        const { canvas: backgroundCanvas, ctx: backgroundCtx } = CanvasFactory.createCanvas(1, 1);
        const { canvas: paintCanvas, ctx: paintCtx } = CanvasFactory.createCanvas(1, 1, {
            willReadFrequently: true // Enable for better performance with getImageData
        });
        
        this.backgroundCanvas = backgroundCanvas;
        this.backgroundCtx = backgroundCtx;
        this.paintCanvas = paintCanvas;
        this.paintCtx = paintCtx;
    }

    handleImageLoad() {
        this.isLoaded = true;
        this.width = this.image.naturalWidth;
        this.height = this.image.naturalHeight;
        
        this.initializeCanvases();
        this.centerImage();
        this.snapToGrid();
        
        // Initialize outpaint mask after image is loaded
        this.outpaintMask = new Mask(this, this.canvasState);
        
        this.canvasState?.scheduleRedraw();
    }

    initializeCanvases() {
        if (!this.width || !this.height) return;
        
        // Resize background canvas
        this.backgroundCanvas.width = this.width;
        this.backgroundCanvas.height = this.height;
        CanvasFactory.clearCanvas(this.backgroundCtx, this.width, this.height);
        
        // Resize paint canvas
        this.paintCanvas.width = this.width;
        this.paintCanvas.height = this.height;
        CanvasFactory.clearCanvas(this.paintCtx, this.width, this.height);
    }

    centerImage() {
        this.x = -(this.width / 2);
        this.y = -(this.height / 2);
    }

    containsPoint(x, y) {
        return (
            x >= this.x &&
            x <= this.x + this.width &&
            y >= this.y &&
            y <= this.y + this.height
        );
    }

    setMode(mode) {
        this.currentMode = mode;
        if (mode === 'outpaint' && !this.outpaintMask && this.isLoaded) {
            this.outpaintMask = new Mask(this, this.canvasState);
            // Initialize with minimum size
            this.outpaintMask.extends = {
                top: CONFIG.OUTPAINT.MIN_SIZE,
                right: CONFIG.OUTPAINT.MIN_SIZE,
                bottom: CONFIG.OUTPAINT.MIN_SIZE,
                left: CONFIG.OUTPAINT.MIN_SIZE
            };
            this.outpaintMask.updateCanvasSize();
        }
    }

    draw(ctx) {
        if (!this.isLoaded || !this.width || !this.height) return;

        // Align coordinates to pixel boundaries for crisp rendering
        const alignedX = Math.round(this.x * this.canvasState.scale) / this.canvasState.scale;
        const alignedY = Math.round(this.y * this.canvasState.scale) / this.canvasState.scale;
        
        ctx.save();
        
        // Draw the base image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.image, alignedX, alignedY, this.width, this.height);

        if (this.canvasState.isPreviewingMask) {
            if (this.currentMode === 'inpaint' && this.paintCanvas.width > 0 && this.paintCanvas.height > 0) {
                ctx.drawImage(this.paintCanvas, alignedX, alignedY);
            } else if (this.outpaintMask) {
                // For outpaint, we need to account for the extended canvas size
                const extendedX = alignedX - this.outpaintMask.extends.left;
                const extendedY = alignedY - this.outpaintMask.extends.top;
                const extendedWidth = this.width + this.outpaintMask.extends.left + this.outpaintMask.extends.right;
                const extendedHeight = this.height + this.outpaintMask.extends.top + this.outpaintMask.extends.bottom;
                
                ctx.drawImage(
                    this.outpaintMask.getMaskCanvas(),
                    Math.round(extendedX * this.canvasState.scale) / this.canvasState.scale,
                    Math.round(extendedY * this.canvasState.scale) / this.canvasState.scale,
                    extendedWidth,
                    extendedHeight
                );
            }
        } else {
            // Normal painting mode
            if (this.currentMode === 'inpaint') {
                // Draw paint background
                ctx.save();
                CanvasFactory.setupCanvasContext(ctx, {
                    globalAlpha: CONFIG.PAINT.BACKGROUND.OPACITY,
                    fillStyle: CONFIG.PAINT.BACKGROUND.COLOR
                });
                ctx.fillRect(alignedX, alignedY, this.width, this.height);
                ctx.restore();
                
                // Draw paint strokes
                ctx.save();
                CanvasFactory.setupCanvasContext(ctx, {
                    globalAlpha: CONFIG.PAINT.BRUSH.OPACITY,
                    fillStyle: CONFIG.PAINT.BRUSH.COLOR,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });
                ctx.drawImage(this.paintCanvas, alignedX, alignedY);
                ctx.restore();
            } else if (this.outpaintMask) {
                this.outpaintMask.draw(ctx);
            }
        }
        
        this.drawCoordinates(ctx);
        ctx.restore();
    }

    getMaskCanvas() {
        return this.currentMode === 'inpaint' ? 
            this.paintCanvas : 
            this.outpaintMask.getMaskCanvas();
    }

    drawCoordinates(ctx) {
        ctx.save();
        CanvasFactory.setupCanvasContext(ctx, {
            font: CONFIG.IMAGE.FONT,
            fillStyle: CONFIG.IMAGE.TEXT_COLOR,
            textBaseline: 'top',
            textAlign: 'left'
        });

        const alignedX = Math.round(this.x * this.canvasState.scale) / this.canvasState.scale;
        const alignedY = Math.round(this.y * this.canvasState.scale) / this.canvasState.scale;
        const textX = alignedX + CONFIG.IMAGE.TEXT_OFFSET_X;
        const textY = alignedY + CONFIG.IMAGE.TEXT_OFFSET_Y;

        // Align text position to pixel boundaries
        const alignedTextX = Math.round(textX * this.canvasState.scale) / this.canvasState.scale;
        const alignedTextY = Math.round(textY * this.canvasState.scale) / this.canvasState.scale;

        ctx.fillText(
            `X: ${Math.round(this.x)}, Y: ${Math.round(this.y * -1)}`,
            alignedTextX,
            alignedTextY
        );
        ctx.restore();
    }

    snapToGrid() {
        const snapped = CoordinateSystem.snapToGrid(this.x, this.y, CONFIG.IMAGE.SNAP_SIZE);
        this.x = snapped.x;
        this.y = snapped.y;
    }

    getPaintContext() {
        return this.paintCtx;
    }
}