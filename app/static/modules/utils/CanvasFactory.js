export class CanvasFactory {
    static createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width || 0;
        canvas.height = height || 0;
        return { canvas, ctx };
    }

    static createImageOnGrayBackground(image, width, height, offsetX = 0, offsetY = 0) {
        const { canvas, ctx } = this.createCanvas(width, height);
        
        // Fill with middle gray (RGB: 128,128,128)
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, width, height);
        
        // Draw the image at the specified offset
        ctx.drawImage(image, offsetX, offsetY);
        
        return canvas;
    }

    static resizeCanvas(canvas, width, height, pixelRatio = 1) {
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        const ctx = canvas.getContext('2d');
        ctx.scale(pixelRatio, pixelRatio);
        return ctx;
    }

    static clearCanvas(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);
    }

    static setupCanvasContext(ctx, options = {}) {
        const {
            strokeStyle,
            fillStyle,
            lineWidth,
            globalAlpha,
            globalCompositeOperation,
            lineCap,
            lineJoin
        } = options;

        if (strokeStyle) ctx.strokeStyle = strokeStyle;
        if (fillStyle) ctx.fillStyle = fillStyle;
        if (lineWidth) ctx.lineWidth = lineWidth;
        if (globalAlpha) ctx.globalAlpha = globalAlpha;
        if (globalCompositeOperation) ctx.globalCompositeOperation = globalCompositeOperation;
        if (lineCap) ctx.lineCap = lineCap;
        if (lineJoin) ctx.lineJoin = lineJoin;
    }
}