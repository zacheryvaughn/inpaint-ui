import { CONFIG } from './config.js';
import { CanvasFactory } from './utils/CanvasFactory.js';
import { CoordinateSystem } from './utils/CoordinateSystem.js';

export default class CanvasState {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.pixelRatio = window.devicePixelRatio || 1;
        this.scale = CONFIG.CANVAS.INITIAL_SCALE * this.pixelRatio;
        this.originX = 0;
        this.originY = 0;
        this.isPanning = false;
        this.animationFrameId = null;
        
        this.setupCanvas();
        this.initializeEventListeners();
    }

    setupCanvas() {
        if (!this.canvas || !this.ctx) {
            console.error('Canvas not supported in this browser');
            return;
        }
        this.resizeCanvasToDisplaySize();
        this.centerOrigin();
        this.scheduleRedraw();
    }

    initializeEventListeners() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        this.resizeObserver = new ResizeObserver(() => {
            this.resizeCanvasToDisplaySize();
            this.scheduleRedraw();
        });
        this.resizeObserver.observe(this.canvas);
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: (e.clientX - rect.left) * this.pixelRatio,
            y: (e.clientY - rect.top) * this.pixelRatio
        };

        const zoomFactor = e.deltaY > 0 ? 1 / CONFIG.CANVAS.SCALE_STEP : CONFIG.CANVAS.SCALE_STEP;
        this.zoom(mousePos, zoomFactor);
    }

    zoom(mousePos, factor) {
        const newScale = Math.min(
            Math.max(
                this.scale * factor,
                CONFIG.CANVAS.MIN_SCALE * this.pixelRatio
            ),
            CONFIG.CANVAS.MAX_SCALE * this.pixelRatio
        );

        if (newScale !== this.scale) {
            this.originX = mousePos.x - (mousePos.x - this.originX) * (newScale / this.scale);
            this.originY = mousePos.y - (mousePos.y - this.originY) * (newScale / this.scale);
            this.scale = newScale;
            
            if (this.paintManager) {
                this.paintManager.updateCursor();
            }
            
            this.scheduleRedraw();
            return true;
        }
        return false;
    }

    cleanup() {
        this.canvas.removeEventListener('contextmenu', e => e.preventDefault());
        this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.removeEventListener('mouseout', this.handleMouseOut.bind(this));
        this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
        this.resizeObserver?.disconnect();
    }

    resizeCanvasToDisplaySize() {
        const { clientWidth: width, clientHeight: height } = this.canvas;
        CanvasFactory.resizeCanvas(this.canvas, width, height, this.pixelRatio);
    }

    centerOrigin() {
        this.originX = this.canvas.width / 2;
        this.originY = this.canvas.height / 2;
    }

    scheduleRedraw() {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame(() => this.draw());
    }

    getWorldCoordinates(clientX, clientY) {
        return CoordinateSystem.worldToCanvas(clientX, clientY, this);
    }
}