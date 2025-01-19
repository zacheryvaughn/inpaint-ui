import { CONFIG } from '../config.js';
import MaskRenderer from './MaskRenderer.js';

export default class DraggableImage {
    constructor(imageUrl, canvasState) {
        this.x = 0
        this.y = 0;
        this.isDragging = false;
        this.isLoaded = false;
        this.canvasState = canvasState;
        
        this.setupImage(imageUrl);
        this.setupCanvases();
    }

    setupImage(imageUrl) {
        this.image = new Image();
        this.image.src = imageUrl;
        this.image.onload = () => this.handleImageLoad();
    }

    setupCanvases() {
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        this.paintCanvas = document.createElement('canvas');
        this.paintCtx = this.paintCanvas.getContext('2d');
    }

    handleImageLoad() {
        this.isLoaded = true;
        this.width = this.image.naturalWidth;
        this.height = this.image.naturalHeight;
        
        this.initializeCanvases();
        this.centerImage();
        this.snapToGrid();
        
        this.canvasState?.scheduleRedraw();
    }

    initializeCanvases() {
        [this.backgroundCanvas, this.paintCanvas].forEach(canvas => {
            canvas.width = this.width;
            canvas.height = this.height;
            canvas.getContext('2d').clearRect(0, 0, this.width, this.height);
        });
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

    draw(ctx) {
        if (!this.isLoaded) return;
        
        // Draw the base image
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        if (this.canvasState.isPreviewingMask) {
            const maskRenderer = new MaskRenderer();
            const previewCanvas = maskRenderer.renderMask(this.image, this.paintCanvas);
            ctx.drawImage(previewCanvas, this.x, this.y);
            ctx.drawImage(previewCanvas, this.x, this.y);
        } else {
            // Normal painting mode
            ctx.save();
            ctx.globalAlpha = CONFIG.PAINT.BACKGROUND.OPACITY;
            ctx.fillStyle = CONFIG.PAINT.BACKGROUND.COLOR;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.restore();
            
            ctx.save();
            ctx.globalAlpha = CONFIG.PAINT.BRUSH.OPACITY;
            ctx.fillStyle = CONFIG.PAINT.BRUSH.COLOR;
            ctx.drawImage(this.paintCanvas, this.x, this.y);
            ctx.restore();
        }
        
        this.drawCoordinates(ctx);
    }

    drawCoordinates(ctx) {
        ctx.font = CONFIG.IMAGE.FONT;
        ctx.fillStyle = CONFIG.IMAGE.TEXT_COLOR;
        ctx.fillText(
            `X: ${Math.round(this.x)}, Y: ${Math.round(this.y * -1)}`,
            this.x + CONFIG.IMAGE.TEXT_OFFSET_X,
            this.y + CONFIG.IMAGE.TEXT_OFFSET_Y
        );
    }

    snapToGrid() {
        this.x = Math.round(this.x / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE;
        this.y = Math.round(this.y / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE;
    }

    getPaintContext() {
        return this.paintCtx;
    }
}