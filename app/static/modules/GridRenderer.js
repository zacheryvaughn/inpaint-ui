import { CONFIG } from './config.js';

export default class GridRenderer {
    constructor(canvasState) {
        this.state = canvasState;
    }

    getViewportBounds() {
        const canvasMinX = -this.state.originX / this.state.scale;
        const canvasMinY = -this.state.originY / this.state.scale;
        return {
            minX: canvasMinX,
            minY: canvasMinY,
            maxX: canvasMinX + this.state.canvas.width / this.state.scale,
            maxY: canvasMinY + this.state.canvas.height / this.state.scale
        };
    }

    draw() {
        const bounds = this.getViewportBounds();
        this.drawDynamicGrid(bounds);
        this.drawOriginCross();
    }

    drawDynamicGrid(bounds) {
        let smallGridSize = null;
        if (this.state.scale >= 2.8) smallGridSize = CONFIG.GRID.SMALL.HIGH_ZOOM;
        else if (this.state.scale >= 1.4) smallGridSize = CONFIG.GRID.SMALL.MEDIUM_ZOOM;
        else if (this.state.scale >= 0.7) smallGridSize = CONFIG.GRID.SMALL.LOW_ZOOM;

        if (smallGridSize) {
            this.drawGridLines(bounds, smallGridSize, CONFIG.GRID.SMALL.COLOR);
        }
        this.drawGridLines(bounds, CONFIG.GRID.LARGE.SIZE, CONFIG.GRID.LARGE.COLOR);
    }

    drawGridLines(bounds, gridSize, color) {
        const ctx = this.state.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / this.state.scale;

        const startX = Math.floor(bounds.minX / gridSize) * gridSize;
        const startY = Math.floor(bounds.minY / gridSize) * gridSize;

        ctx.beginPath();
        for (let x = startX; x <= bounds.maxX; x += gridSize) {
            ctx.moveTo(x, bounds.minY);
            ctx.lineTo(x, bounds.maxY);
        }
        for (let y = startY; y <= bounds.maxY; y += gridSize) {
            ctx.moveTo(bounds.minX, y);
            ctx.lineTo(bounds.maxX, y);
        }
        ctx.stroke();
    }

    drawOriginCross() {
        const ctx = this.state.ctx;
        const size = CONFIG.GRID.ORIGIN_CROSS_SIZE;
        
        ctx.strokeStyle = CONFIG.GRID.ORIGIN_COLOR;
        ctx.lineWidth = 1 / this.state.scale;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();
    }
}