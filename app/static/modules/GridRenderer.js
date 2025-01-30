import { CONFIG } from './config.js';
import { CanvasFactory } from './utils/CanvasFactory.js';
import { CoordinateSystem } from './utils/CoordinateSystem.js';

export default class GridRenderer {
    constructor(canvasState) {
        this.state = canvasState;
    }

    draw() {
        const bounds = CoordinateSystem.getViewportBounds(this.state);
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
        CanvasFactory.setupCanvasContext(this.state.ctx, {
            strokeStyle: color,
            lineWidth: 1 / this.state.scale,
            lineCap: 'butt',
            lineJoin: 'miter'
        });

        const startX = Math.floor(bounds.minX / gridSize) * gridSize;
        const startY = Math.floor(bounds.minY / gridSize) * gridSize;
        const endX = Math.ceil(bounds.maxX / gridSize) * gridSize;
        const endY = Math.ceil(bounds.maxY / gridSize) * gridSize;

        this.state.ctx.beginPath();
        
        // Draw vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            const alignedX = Math.round(x * this.state.scale) / this.state.scale;
            this.state.ctx.moveTo(alignedX, bounds.minY);
            this.state.ctx.lineTo(alignedX, bounds.maxY);
        }
        
        // Draw horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            const alignedY = Math.round(y * this.state.scale) / this.state.scale;
            this.state.ctx.moveTo(bounds.minX, alignedY);
            this.state.ctx.lineTo(bounds.maxX, alignedY);
        }
        
        this.state.ctx.stroke();
    }

    drawOriginCross() {
        const size = CONFIG.GRID.ORIGIN_CROSS_SIZE;
        
        CanvasFactory.setupCanvasContext(this.state.ctx, {
            strokeStyle: CONFIG.GRID.ORIGIN_COLOR,
            lineWidth: 1 / this.state.scale,
            lineCap: 'butt',
            lineJoin: 'miter'
        });

        // Align to pixel boundaries for crisp lines
        const alignedSize = Math.round(size * this.state.scale) / this.state.scale;
        
        this.state.ctx.beginPath();
        
        // Horizontal line
        const alignedY = Math.round(0 * this.state.scale) / this.state.scale;
        this.state.ctx.moveTo(-alignedSize, alignedY);
        this.state.ctx.lineTo(alignedSize, alignedY);
        
        // Vertical line
        const alignedX = Math.round(0 * this.state.scale) / this.state.scale;
        this.state.ctx.moveTo(alignedX, -alignedSize);
        this.state.ctx.lineTo(alignedX, alignedSize);
        
        this.state.ctx.stroke();
    }
}