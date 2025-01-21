import { CONFIG } from '../config.js';

export default class MaskRenderer {
    constructor() {
        this.setupCanvases();
    }

    setupCanvases() {
        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.whiteCanvas = document.createElement('canvas');
        this.whiteCtx = this.whiteCanvas.getContext('2d');
    }

    renderMask(image, paintCanvas) {
        this.previewCanvas.width = image.naturalWidth;
        this.previewCanvas.height = image.naturalHeight;
        this.whiteCanvas.width = image.naturalWidth;
        this.whiteCanvas.height = image.naturalHeight;
        
        // Draw the paint canvas onto the white canvas
        this.whiteCtx.drawImage(paintCanvas, 0, 0, image.naturalWidth, image.naturalHeight);
        
        // Fill the painted areas with white
        this.whiteCtx.globalCompositeOperation = 'source-in';
        this.whiteCtx.fillStyle = '#FFFFFF';
        this.whiteCtx.fillRect(0, 0, image.naturalWidth, image.naturalHeight);

        // Fill the preview canvas with black
        this.previewCtx.fillStyle = '#000000';
        this.previewCtx.fillRect(0, 0, image.naturalWidth, image.naturalHeight);

        // Draw the white mask onto the preview canvas
        this.previewCtx.drawImage(this.whiteCanvas, 0, 0);

        return this.previewCanvas;
    }
}