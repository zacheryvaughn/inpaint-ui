export default class CursorManager {
    constructor(canvasState) {
        this.canvasState = canvasState;
        this.cursorOverlay = this.createOverlay();
        this.isVisible = false;
        this.updateOverlayPosition = this.updateOverlayPosition.bind(this);
        
        this.canvasState.canvas.addEventListener('mousemove', this.updateOverlayPosition);
        this.canvasState.canvas.addEventListener('mouseleave', () => {
            this.hideOverlay();
        });
        this.canvasState.canvas.addEventListener('mouseenter', () => {
            if (this.isVisible) {
                this.showOverlay();
            }
        });
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            display: none;
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    updateOverlayPosition(e) {
        if (!this.isVisible) return;
        
        const rect = this.canvasState.canvas.getBoundingClientRect();
        this.cursorOverlay.style.left = `${e.clientX}px`;
        this.cursorOverlay.style.top = `${e.clientY}px`;
    }

    updateCursorSize(size) {
        const scaledSize = size * this.canvasState.scale;
        this.cursorOverlay.style.width = `${scaledSize}px`;
        this.cursorOverlay.style.height = `${scaledSize}px`;
    }

    showOverlay() {
        this.cursorOverlay.style.display = 'block';
    }

    hideOverlay() {
        this.cursorOverlay.style.display = 'none';
    }

    setCursorVisibility(visible) {
        this.isVisible = visible;
        if (visible) {
            this.showOverlay();
            this.canvasState.canvas.style.cursor = 'none';
        } else {
            this.hideOverlay();
            this.canvasState.canvas.style.cursor = 'default';
        }
    }

    cleanup() {
        this.canvasState.canvas.removeEventListener('mousemove', this.updateOverlayPosition);
        this.cursorOverlay.remove();
    }
}