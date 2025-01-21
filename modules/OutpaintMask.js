import { CONFIG } from '../config.js';

export default class OutpaintMask {
    constructor(image, canvasState) {
        this.image = image;
        this.canvasState = canvasState;
        this.maskOverlap = CONFIG.OUTPAINT.DEFAULT_OVERLAP;
        
        this.extends = {
            top: CONFIG.OUTPAINT.MIN_SIZE,
            right: CONFIG.OUTPAINT.MIN_SIZE,
            bottom: CONFIG.OUTPAINT.MIN_SIZE,
            left: CONFIG.OUTPAINT.MIN_SIZE
        };
        
        this.isDragging = false;
        this.dragEdge = null;
        this.dragStart = null;
        
        this.setupCanvas();
        this.setupControls();
    }

    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.updateCanvasSize();
    }

    setupControls() {
        const overlapSlider = document.getElementById('maskOverlap');
        if (overlapSlider) {
            overlapSlider.min = CONFIG.OUTPAINT.MIN_OVERLAP;
            overlapSlider.max = CONFIG.OUTPAINT.MAX_OVERLAP;
            overlapSlider.value = CONFIG.OUTPAINT.DEFAULT_OVERLAP;
            
            overlapSlider.addEventListener('input', (e) => {
                this.maskOverlap = Math.min(
                    Math.max(
                        parseInt(e.target.value),
                        CONFIG.OUTPAINT.MIN_OVERLAP
                    ),
                    CONFIG.OUTPAINT.MAX_OVERLAP
                );
                document.getElementById('maskOverlapValue').textContent = this.maskOverlap;
                this.updateCanvasSize();
                this.canvasState.scheduleRedraw();
            });
        }
    }

    handleMouseDown(e) {
        if (e.button !== 0) return false;
    
        const edge = this.getHoveredEdge(e);
        if (edge) {
            this.isDragging = true;
            this.dragEdge = edge;
            this.dragStart = this.canvasState.getWorldCoordinates(e.clientX, e.clientY);
            return true;
        }
        return false;
    }

    handleMouseMove(e) {
        if (!this.isDragging) {
            const edge = this.getHoveredEdge(e);
            if (edge) {
                switch(edge) {
                    case 'left':
                    case 'right':
                        this.canvasState.canvas.style.cursor = 'ew-resize';
                        break;
                    case 'top':
                    case 'bottom':
                        this.canvasState.canvas.style.cursor = 'ns-resize';
                        break;
                }
            } else {
                this.canvasState.canvas.style.cursor = 'default';
            }
            return;
        }
    
        const currentPos = this.canvasState.getWorldCoordinates(e.clientX, e.clientY);
    
        const constrainSize = (size) => {
            return Math.min(
                Math.max(size, CONFIG.OUTPAINT.MIN_SIZE),
                CONFIG.OUTPAINT.MAX_SIZE
            );
        };
    
        switch(this.dragEdge) {
            case 'left': {
                const extension = Math.max(0, this.image.x - currentPos.x);
                this.extends.left = constrainSize(
                    Math.round(extension / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE
                );
                break;
            }
            case 'right': {
                const extension = Math.max(0, currentPos.x - (this.image.x + this.image.width));
                this.extends.right = constrainSize(
                    Math.round(extension / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE
                );
                break;
            }
            case 'top': {
                const extension = Math.max(0, this.image.y - currentPos.y);
                this.extends.top = constrainSize(
                    Math.round(extension / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE
                );
                break;
            }
            case 'bottom': {
                const extension = Math.max(0, currentPos.y - (this.image.y + this.image.height));
                this.extends.bottom = constrainSize(
                    Math.round(extension / CONFIG.IMAGE.SNAP_SIZE) * CONFIG.IMAGE.SNAP_SIZE
                );
                break;
            }
        }
    
        this.updateCanvasSize();
        this.canvasState.scheduleRedraw();
    }

    handleMouseUp() {
        this.isDragging = false;
        this.dragEdge = null;
        this.dragStart = null;
        this.canvasState.canvas.style.cursor = 'default';
    }

    getHoveredEdge(e) {
        const coords = this.canvasState.getWorldCoordinates(e.clientX, e.clientY);
        const edgeThreshold = 10 / this.canvasState.scale;
    
        const bounds = {
            left: this.image.x - this.extends.left,
            right: this.image.x + this.image.width + this.extends.right,
            top: this.image.y - this.extends.top,
            bottom: this.image.y + this.image.height + this.extends.bottom
        };
    
        const withinVerticalBounds = coords.y >= bounds.top && coords.y <= bounds.bottom;
        const withinHorizontalBounds = coords.x >= bounds.left && coords.x <= bounds.right;
    
        if (Math.abs(coords.x - bounds.left) < edgeThreshold && withinVerticalBounds) {
            return 'left';
        }
        if (Math.abs(coords.x - bounds.right) < edgeThreshold && withinVerticalBounds) {
            return 'right';
        }
        if (Math.abs(coords.y - bounds.top) < edgeThreshold && withinHorizontalBounds) {
            return 'top';
        }
        if (Math.abs(coords.y - bounds.bottom) < edgeThreshold && withinHorizontalBounds) {
            return 'bottom';
        }
    
        return null;
    }

    updateCanvasSize() {
        if (!this.image.isLoaded) return;
        
        const width = this.image.width + this.extends.left + this.extends.right;
        const height = this.image.height + this.extends.top + this.extends.bottom;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.clearRect(0, 0, width, height);
        
        const overlaps = {
            left: this.extends.left > 0 ? this.maskOverlap : 0,
            right: this.extends.right > 0 ? this.maskOverlap : 0,
            top: this.extends.top > 0 ? this.maskOverlap : 0,
            bottom: this.extends.bottom > 0 ? this.maskOverlap : 0
        };
        
        // Fill everything with black (masked area)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw the outpaint areas in white
        this.ctx.fillStyle = '#FFFFFF';
        
        if (this.extends.left > 0) {
            this.ctx.fillRect(0, 0, this.extends.left + overlaps.left, height);
        }
        
        if (this.extends.right > 0) {
            this.ctx.fillRect(
                width - this.extends.right - overlaps.right, 0,
                this.extends.right + overlaps.right, height
            );
        }
        
        if (this.extends.top > 0) {
            this.ctx.fillRect(0, 0, width, this.extends.top + overlaps.top);
        }
        
        if (this.extends.bottom > 0) {
            this.ctx.fillRect(
                0, height - this.extends.bottom - overlaps.bottom,
                width, this.extends.bottom + overlaps.bottom
            );
        }
    }
    
    draw(ctx) {
        if (!this.image.isLoaded) return;
    
        const overlaps = {
            left: this.extends.left > 0 ? this.maskOverlap : 0,
            right: this.extends.right > 0 ? this.maskOverlap : 0,
            top: this.extends.top > 0 ? this.maskOverlap : 0,
            bottom: this.extends.bottom > 0 ? this.maskOverlap : 0
        };
    
        ctx.save();
        ctx.strokeStyle = 'rgba(17, 187, 238, 0.8)';
        ctx.lineWidth = 2 / this.canvasState.scale;
        ctx.setLineDash([4 / this.canvasState.scale]);
        
        ctx.strokeRect(
            this.image.x - this.extends.left,
            this.image.y - this.extends.top,
            this.image.width + this.extends.left + this.extends.right,
            this.image.height + this.extends.top + this.extends.bottom
        );
    
        if (this.maskOverlap > 0) {
            ctx.strokeStyle = 'rgba(17, 187, 238, 0.4)';
            if (this.extends.left > 0 || this.extends.right > 0 || 
                this.extends.top > 0 || this.extends.bottom > 0) {
                
                const x = this.image.x + (this.extends.left > 0 ? overlaps.left : 0);
                const y = this.image.y + (this.extends.top > 0 ? overlaps.top : 0);
                const w = this.image.width - (overlaps.left + overlaps.right);
                const h = this.image.height - (overlaps.top + overlaps.bottom);
                
                ctx.strokeRect(x, y, w, h);
            }
        }
        ctx.restore();
    
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BACKGROUND.OPACITY;
        ctx.fillStyle = CONFIG.PAINT.BACKGROUND.COLOR;
        ctx.fillRect(
            this.image.x - this.extends.left,
            this.image.y - this.extends.top,
            this.image.width + this.extends.left + this.extends.right,
            this.image.height + this.extends.top + this.extends.bottom
        );
        ctx.restore();
    
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BRUSH.OPACITY;
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    
        if (this.extends.left > 0 || this.extends.right > 0 || 
            this.extends.top > 0 || this.extends.bottom > 0) {
            
            ctx.beginPath();
            
            ctx.rect(
                this.image.x - this.extends.left,
                this.image.y - this.extends.top,
                this.image.width + this.extends.left + this.extends.right,
                this.image.height + this.extends.top + this.extends.bottom
            );
            
            ctx.rect(
                this.image.x + overlaps.left,
                this.image.y + overlaps.top,
                this.image.width - (overlaps.left + overlaps.right),
                this.image.height - (overlaps.top + overlaps.bottom)
            );
            
            ctx.fill('evenodd');
        }
    
        ctx.restore();
    }

    getMaskCanvas() {
        this.updateCanvasSize();
        return this.canvas;
    }
}