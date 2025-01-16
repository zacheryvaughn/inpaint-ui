import { CONFIG } from './config.js';

// Base class for handling canvas state and common functionality
class CanvasState {
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
            
            // Update cursor for zoom
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
        this.canvas.width = width * this.pixelRatio;
        this.canvas.height = height * this.pixelRatio;
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
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
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * this.pixelRatio / this.scale - this.originX / this.scale,
            y: (clientY - rect.top) * this.pixelRatio / this.scale - this.originY / this.scale
        };
    }

    draw() {
        // Implemented by child classes
    }
}

// Enhanced cursor manager with overlay support
class CursorManager {
    constructor(canvasState) {
        this.canvasState = canvasState;
        this.cursorOverlay = this.createOverlay();
        this.isVisible = false;
        
        // Bind methods
        this.updateOverlayPosition = this.updateOverlayPosition.bind(this);
        
        // Add mouse move listener to canvas
        this.canvasState.canvas.addEventListener('mousemove', this.updateOverlayPosition);
        
        // Add mouse leave listener to hide overlay
        this.canvasState.canvas.addEventListener('mouseleave', () => {
            this.hideOverlay();
        });
        
        // Add mouse enter listener to show overlay
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

// Handles grid rendering functionality
class GridRenderer {
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

// Handles draggable image functionality
class DraggableImage {
    constructor(imageUrl, canvasState) {
        this.x = 0;
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
        
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        
        // Draw background mask
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BACKGROUND.OPACITY;
        ctx.fillStyle = CONFIG.PAINT.BACKGROUND.COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
        
        // Draw paint layer
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BRUSH.OPACITY;
        ctx.drawImage(this.paintCanvas, this.x, this.y);
        ctx.restore();
        
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

// Manages painting functionality
class PaintManager {
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

// Main interactive canvas class that ties everything together
class InteractiveCanvas extends CanvasState {
    constructor(canvasId) {
        super(canvasId);
        this.gridRenderer = new GridRenderer(this);
        this.images = [];
        this.draggedImage = null;
        this.dragOffset = { x: 0, y: 0 };
        this.paintManager = new PaintManager(this);
        this.currentTool = 'move';
        
        this.setupImageImport();
        this.setupToolSelection();
    }

    setupImageImport() {
        const importButton = document.getElementById('import-operation');
        const imageInput = document.getElementById('imageInput');
    
        importButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', this.handleImageImport.bind(this));
    }

    handleImageImport(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(file);
            const newImage = new DraggableImage(imageUrl, this);
            this.images.push(newImage);
            this.scheduleRedraw();
            e.target.value = '';
        }
    }

    setupToolSelection() {
        const tools = ['move', 'paint', 'eraser'];
        const buttons = tools.reduce((acc, tool) => {
            acc[tool] = document.getElementById(`${tool}-tool`);
            return acc;
        }, {});

        buttons.move.classList.add('selected');
        
        tools.forEach(tool => {
            buttons[tool].addEventListener('click', () => {
                this.updateToolSelection(tool, buttons);
            });
        });
    }

    updateToolSelection(selectedTool, buttons) {
        Object.values(buttons).forEach(button => button.classList.remove('selected'));
        buttons[selectedTool].classList.add('selected');
        this.currentTool = selectedTool;
        this.paintManager.setTool(selectedTool);
    }

    handleMouseDown(e) {
        if ((this.currentTool === 'paint' || this.currentTool === 'eraser') && e.button === 0) {
            this.paintManager.startPainting(e);
        } else if (e.button === 2) {
            this.startPanning(e);
        } else if (e.button === 0 && this.currentTool === 'move') {
            this.startDraggingImage(e);
        } else if (e.button === 1) {
            e.preventDefault();
            this.centerOrigin();
            this.scheduleRedraw();
        }
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            this.updatePanning(e);
        } else if (this.draggedImage && this.currentTool === 'move') {
            this.updateImageDrag(e);
        } else if (this.paintManager.isPainting) {
            this.paintManager.paint(e);
        }
    }

    handleMouseUp(e) {
        if (e.button === 2 && this.isPanning) {
            this.isPanning = false;
            this.paintManager.updateCursor();
        } else if (e.button === 0) {
            if (this.draggedImage) {
                this.draggedImage.isDragging = false;
                this.draggedImage = null;
                this.paintManager.updateCursor();
            }
            if (this.paintManager.isPainting) {
                this.paintManager.stopPainting();
            }
        }
    }

    handleMouseOut() {
        if (this.isPanning) {
            this.isPanning = false;
            this.paintManager.updateCursor();
        }
        if (this.draggedImage) {
            this.draggedImage.isDragging = false;
            this.draggedImage = null;
            this.paintManager.updateCursor();
        }
        if (this.paintManager.isPainting) {
            this.paintManager.stopPainting();
        }
    }

    startPanning(e) {
        this.isPanning = true;
        this.dragOffset = {
            x: e.clientX * this.pixelRatio - this.originX,
            y: e.clientY * this.pixelRatio - this.originY
        };
        this.canvas.style.cursor = 'grabbing';
    }

    updatePanning(e) {
        if (!this.isPanning) return;
        
        this.originX = e.clientX * this.pixelRatio - this.dragOffset.x;
        this.originY = e.clientY * this.pixelRatio - this.dragOffset.y;
        this.scheduleRedraw();
    }

    startDraggingImage(e) {
        const coords = this.getWorldCoordinates(e.clientX, e.clientY);
        
        for (let i = this.images.length - 1; i >= 0; i--) {
            const img = this.images[i];
            if (img.containsPoint(coords.x, coords.y)) {
                this.draggedImage = img;
                this.dragOffset = {
                    x: coords.x - img.x,
                    y: coords.y - img.y
                };
                img.isDragging = true;
                
                // Move image to top
                this.images.splice(i, 1);
                this.images.push(img);
                
                this.canvas.style.cursor = 'grabbing';
                break;
            }
        }
    }

    updateImageDrag(e) {
        if (!this.draggedImage) return;
        
        const coords = this.getWorldCoordinates(e.clientX, e.clientY);
        this.draggedImage.x = coords.x - this.dragOffset.x;
        this.draggedImage.y = coords.y - this.dragOffset.y;
        this.draggedImage.snapToGrid();
        
        this.scheduleRedraw();
    }

    draw() {
        this.ctx.fillStyle = CONFIG.CANVAS.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.originX, this.originY);
        
        this.gridRenderer.draw();
        this.images.forEach(img => img.draw(this.ctx));
        
        this.ctx.restore();
    }
}

// Initialize the canvas
const canvas = new InteractiveCanvas('canvas');