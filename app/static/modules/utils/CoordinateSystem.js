export class CoordinateSystem {
    static worldToCanvas(clientX, clientY, state) {
        const rect = state.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * state.pixelRatio / state.scale - state.originX / state.scale,
            y: (clientY - rect.top) * state.pixelRatio / state.scale - state.originY / state.scale
        };
    }

    static canvasToWorld(x, y, state) {
        return {
            x: x * state.scale + state.originX,
            y: y * state.scale + state.originY
        };
    }

    static getViewportBounds(state) {
        const canvasMinX = -state.originX / state.scale;
        const canvasMinY = -state.originY / state.scale;
        return {
            minX: canvasMinX,
            minY: canvasMinY,
            maxX: canvasMinX + state.canvas.width / state.scale,
            maxY: canvasMinY + state.canvas.height / state.scale
        };
    }

    static snapToGrid(x, y, gridSize) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
}