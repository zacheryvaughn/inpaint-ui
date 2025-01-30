import { Mask } from '../Mask.js';

export class MaskPreviewManager {
    constructor(assembledInterface, events) {
        this.interface = assembledInterface;
        this.events = events;
        this.isPreviewingMask = false;
        this.previewImage = null;

        this.setupPreviewButton();
        this.setupSocketListener();
    }

    setupSocketListener() {
        this.events.socket.on('mask_preview_response', (data) => {
            console.log('Received mask_preview_response');
            // Create an image from the blurred mask
            const img = new Image();
            img.onload = () => {
                this.previewImage = img;
                this.interface.scheduleRedraw();
            };
            img.onerror = (error) => {
                console.error('Error loading preview image:', error);
            };
            img.src = data.blurred_mask;
        });
    }

    setupPreviewButton() {
        // Setup blur radius slider
        const blurRadiusSlider = document.getElementById('blurRadius');
        const blurRadiusValue = document.getElementById('blurRadiusValue');

        blurRadiusSlider.addEventListener('input', (e) => {
            blurRadiusValue.textContent = e.target.value;
            this.showPreview();
        });

        blurRadiusSlider.addEventListener('mouseup', () => this.resetPreview());
        blurRadiusSlider.addEventListener('mouseleave', () => this.resetPreview());

        const previewButton = document.getElementById('preview-mask');
        previewButton.addEventListener('mousedown', () => this.showPreview());
        previewButton.addEventListener('mouseup', () => this.resetPreview());
        previewButton.addEventListener('mouseleave', () => this.resetPreview());
    }

    showPreview() {
        if (this.interface.images.length === 0) return;

        const image = this.interface.images[this.interface.images.length - 1];
        let maskCanvas;

        if (this.interface.currentMode === 'outpaint' && image.outpaintMask) {
            // For outpaint mode, use the outpaint mask
            const mask = image.outpaintMask;
            maskCanvas = mask.getMaskCanvas();
        } else {
            // For inpaint mode, use Mask directly
            maskCanvas = Mask.renderInpaintMask(image.image, image.paintCanvas);
        }

        // Get current blur radius
        const blurRadius = parseInt(document.getElementById('blurRadius').value);

        // Convert canvas to base64 PNG and send via socket
        const maskPngData = maskCanvas.toDataURL('image/png');
        this.events.emit('mask_preview', {
            mask: maskPngData,
            mode: this.interface.currentMode,
            blurRadius: blurRadius
        });

        this.isPreviewingMask = true;
        this.interface.scheduleRedraw();
    }

    resetPreview() {
        this.isPreviewingMask = false;
        this.previewImage = null;
        this.interface.scheduleRedraw();
    }

    // Helper methods for AssembledInterface to check state
    isPreviewActive() {
        return this.isPreviewingMask;
    }

    getPreviewImage() {
        return this.previewImage;
    }
}