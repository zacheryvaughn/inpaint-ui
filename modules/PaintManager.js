import { CONFIG } from '../config.js';
import { CursorManager } from './CursorManager.js';

export default class PaintManager {
    constructor(canvasState) {
        this.canvasState = canvasState;
        this.cursorManager = new CursorManager(canvasState);
        this.currentTool = 'move';
        this.isPainting = false;
        this.paintTarget = null;
        this.lastPaintPos = null;
        this.strokePoints = [];
        this.smoothingFactor = CONFIG.PAINT.SMOOTHING_FACTOR;
        this.brushSize = CONFIG.PAINT.BRUSH.SIZE;
        this.eraserSize = CONFIG.PAINT.ERASER.SIZE;
        
        this.setupControls();
    }

    setupControls() {
        this.setupSizeControl('brush');
        this.setupSizeControl('eraser');
        this.setupOpacityControl('mask', 'BACKGROUND');
        this.setupOpacityControl('brush', 'BRUSH');
        this.setupFeatherControl();  // Add this line
    }
    
    setupFeatherControl() {
        const slider = document.getElementById('featherAmount');
        const value = document.getElementById('featherAmountValue');
        
        slider.value = CONFIG.PAINT.FEATHER.RADIUS;
        value.textContent = CONFIG.PAINT.FEATHER.RADIUS;
        
        slider.addEventListener('input', (e) => {
            const radius = parseInt(e.target.value);
            CONFIG.PAINT.FEATHER.RADIUS = radius;
            CONFIG.PAINT.FEATHER.ENABLED = radius > 0;
            value.textContent = radius;
            this.canvasState.scheduleRedraw();
        });
    }

    setupSizeControl(tool) {
        const slider = document.getElementById(`${tool}Size`);
        const value = document.getElementById(`${tool}SizeValue`);
        const size = tool === 'brush' ? this.brushSize : this.eraserSize;
        
        slider.value = size;
        value.textContent = size;
        
        slider.addEventListener('input', (e) => {
            const newSize = parseInt(e.target.value);
            if (tool === 'brush') {
                this.brushSize = newSize;
                CONFIG.PAINT.BRUSH.SIZE = newSize;
            } else {
                this.eraserSize = newSize;
                CONFIG.PAINT.ERASER.SIZE = newSize;
            }
            value.textContent = newSize;
            this.updateCursor();
        });
    }

    setupOpacityControl(type, configKey) {
        const slider = document.getElementById(`${type}Opacity`);
        const value = document.getElementById(`${type}OpacityValue`);
        
        slider.value = CONFIG.PAINT[configKey].OPACITY;
        value.textContent = CONFIG.PAINT[configKey].OPACITY.toFixed(1);
        
        slider.addEventListener('input', (e) => {
            CONFIG.PAINT[configKey].OPACITY = parseFloat(e.target.value);
            value.textContent = CONFIG.PAINT[configKey].OPACITY.toFixed(1);
            this.canvasState.scheduleRedraw();
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
    }

    updateCursor() {
        if (this.currentTool === 'move') {
            this.cursorManager.setCursorVisibility(false);
            return;
        }
        
        const size = this.getCurrentSize();
        this.cursorManager.updateCursorSize(size);
        this.cursorManager.setCursorVisibility(true);
    }

    getCurrentSize() {
        return this.currentTool === 'eraser' ? this.eraserSize : this.brushSize;
    }

    startPainting(e) {
        const coords = this.canvasState.getWorldCoordinates(e.clientX, e.clientY);
        
        for (let i = this.canvasState.images.length - 1; i >= 0; i--) {
            const img = this.canvasState.images[i];
            if (img.containsPoint(coords.x, coords.y)) {
                this.paintTarget = img;
                this.isPainting = true;
                this.lastPaintPos = coords;
                this.strokePoints = [coords];
                this.paint(e);
                break;
            }
        }
    }

    paint(e) {
        if (!this.isPainting || !this.paintTarget) return;
    
        const coords = this.canvasState.getWorldCoordinates(e.clientX, e.clientY);
        this.strokePoints.push(coords);
        
        const smoothedPoint = this.getSmoothPoint(this.strokePoints);
        if (!smoothedPoint || !this.lastPaintPos) {
            this.lastPaintPos = smoothedPoint;
            return;
        }
    
        this.drawStroke(smoothedPoint);
        this.lastPaintPos = smoothedPoint;
    
        if (this.strokePoints.length > this.smoothingFactor * 2) {
            this.strokePoints = this.strokePoints.slice(-this.smoothingFactor);
        }
    
        this.canvasState.scheduleRedraw();
    }

    drawStroke(smoothedPoint) {
        const ctx = this.paintTarget.getPaintContext();
        const currentSize = this.getCurrentSize();
        
        const intermediatePoints = this.getIntermediatePoints(
            {
                x: this.lastPaintPos.x - this.paintTarget.x,
                y: this.lastPaintPos.y - this.paintTarget.y
            },
            {
                x: smoothedPoint.x - this.paintTarget.x,
                y: smoothedPoint.y - this.paintTarget.y
            }
        );
    
        ctx.save();
        
        this.setupStrokeStyle(ctx, currentSize);
        
        if (intermediatePoints.length > 1) {
            this.drawSmoothLine(ctx, intermediatePoints);
        }
        
        ctx.restore();
    }

    setupStrokeStyle(ctx, size) {
        if (this.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.strokeStyle = CONFIG.PAINT.BRUSH.COLOR;
            ctx.globalCompositeOperation = 'source-over';
        }
        
        ctx.lineWidth = size * 2 * this.canvasState.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.scale(1 / this.canvasState.scale, 1 / this.canvasState.scale);
    }

    drawSmoothLine(ctx, points) {
        ctx.beginPath();
        ctx.moveTo(
            points[0].x * this.canvasState.scale, 
            points[0].y * this.canvasState.scale
        );
        
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            const prevPoint = points[i - 1];
            const midPoint = {
                x: (prevPoint.x + point.x) / 2,
                y: (prevPoint.y + point.y) / 2
            };
            
            ctx.quadraticCurveTo(
                prevPoint.x * this.canvasState.scale, 
                prevPoint.y * this.canvasState.scale,
                midPoint.x * this.canvasState.scale, 
                midPoint.y * this.canvasState.scale
            );
        }
        
        ctx.stroke();
    }

    stopPainting() {
        this.isPainting = false;
        this.paintTarget = null;
        this.lastPaintPos = null;
        this.strokePoints = [];
    }

    getIntermediatePoints(start, end) {
        const distance = this.getDistance(start, end);
        const stepSize = this.getCurrentSize() / 2;
        const steps = Math.max(1, Math.floor(distance / stepSize));
        
        const points = [];
        for (let i = 0; i <= steps; i++) {
            points.push(this.lerp(start, end, i / steps));
        }
        return points;
    }

    getSmoothPoint(points) {
        if (points.length === 0) return null;
        
        const recentPoints = points.slice(-this.smoothingFactor);
        let smoothX = 0;
        let smoothY = 0;
        let totalWeight = 0;
        
        recentPoints.forEach((point, index) => {
            const weight = index + 1;
            smoothX += point.x * weight;
            smoothY += point.y * weight;
            totalWeight += weight;
        });
        
        return {
            x: smoothX / totalWeight,
            y: smoothY / totalWeight
        };
    }

    lerp(start, end, t) {
        return {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
        };
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
}