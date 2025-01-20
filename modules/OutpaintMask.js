import { CONFIG } from '../config.js';

export default class OutpaintMask {
    constructor(image, canvasState) {
        this.image = image;
        this.canvasState = canvasState;
        this.maskOverlap = CONFIG.OUTPAINT.DEFAULT_OVERLAP;
        
        // Initialize with minimum size
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
            // Update slider attributes to respect configs
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

    // Handle mouse interactions
    handleMouseDown(e) {
        // Only handle left mouse button (button === 0)
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

    // In OutpaintMask.js, modify the handleMouseMove method:
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
    
        // Helper function to constrain extension size
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
        const edgeThreshold = 10 / this.canvasState.scale; // Adjust hit area based on zoom
    
        // Calculate the full mask boundaries
        const bounds = {
            left: this.image.x - this.extends.left,
            right: this.image.x + this.image.width + this.extends.right,
            top: this.image.y - this.extends.top,
            bottom: this.image.y + this.image.height + this.extends.bottom
        };
    
        // Check if we're within the vertical bounds when checking left/right edges
        const withinVerticalBounds = coords.y >= bounds.top && coords.y <= bounds.bottom;
        // Check if we're within the horizontal bounds when checking top/bottom edges
        const withinHorizontalBounds = coords.x >= bounds.left && coords.x <= bounds.right;
    
        // Check left edge
        if (Math.abs(coords.x - bounds.left) < edgeThreshold && withinVerticalBounds) {
            return 'left';
        }
        
        // Check right edge
        if (Math.abs(coords.x - bounds.right) < edgeThreshold && withinVerticalBounds) {
            return 'right';
        }
        
        // Check top edge
        if (Math.abs(coords.y - bounds.top) < edgeThreshold && withinHorizontalBounds) {
            return 'top';
        }
        
        // Check bottom edge
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
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Calculate overlap for each edge only if it has an extension
        const overlaps = {
            left: this.extends.left > 0 ? this.maskOverlap : 0,
            right: this.extends.right > 0 ? this.maskOverlap : 0,
            top: this.extends.top > 0 ? this.maskOverlap : 0,
            bottom: this.extends.bottom > 0 ? this.maskOverlap : 0
        };
        
        // First fill everything with black (masked area)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);
        
        // Then draw the outpaint areas in white
        this.ctx.fillStyle = '#FFFFFF';
        
        // Draw each outpaint region including overlap
        if (this.extends.left > 0) {
            this.ctx.fillRect(0, 0, this.extends.left + overlaps.left, height);
        }
        if (this.extends.right > 0) {
            this.ctx.fillRect(width - this.extends.right - overlaps.right, 0, this.extends.right + overlaps.right, height);
        }
        if (this.extends.top > 0) {
            this.ctx.fillRect(0, 0, width, this.extends.top + overlaps.top);
        }
        if (this.extends.bottom > 0) {
            this.ctx.fillRect(0, height - this.extends.bottom - overlaps.bottom, width, this.extends.bottom + overlaps.bottom);
        }
    }
    
    draw(ctx) {
        if (!this.image.isLoaded) return;
    
        // Calculate active overlaps
        const overlaps = {
            left: this.extends.left > 0 ? this.maskOverlap : 0,
            right: this.extends.right > 0 ? this.maskOverlap : 0,
            top: this.extends.top > 0 ? this.maskOverlap : 0,
            bottom: this.extends.bottom > 0 ? this.maskOverlap : 0
        };
    
        // Draw the preview outline
        ctx.save();
        ctx.strokeStyle = 'rgba(17, 187, 238, 0.8)'; // primary-blue
        ctx.lineWidth = 2 / this.canvasState.scale;
        ctx.setLineDash([4 / this.canvasState.scale]);
        
        // Draw extended area rectangle
        ctx.strokeRect(
            this.image.x - this.extends.left,
            this.image.y - this.extends.top,
            this.image.width + this.extends.left + this.extends.right,
            this.image.height + this.extends.top + this.extends.bottom
        );
    
        // Draw overlap area if there is any overlap
        if (this.maskOverlap > 0) {
            ctx.strokeStyle = 'rgba(17, 187, 238, 0.4)';
            // Only draw overlap lines for edges that have extensions
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
    
        // Draw the background black overlay
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BACKGROUND.OPACITY;
        ctx.fillStyle = CONFIG.PAINT.BACKGROUND.COLOR; // This is black
        ctx.fillRect(
            this.image.x - this.extends.left,
            this.image.y - this.extends.top,
            this.image.width + this.extends.left + this.extends.right,
            this.image.height + this.extends.top + this.extends.bottom
        );
        ctx.restore();
    
        // Draw the red overlay only in the outpaint regions
        ctx.save();
        ctx.globalAlpha = CONFIG.PAINT.BRUSH.OPACITY;
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    
        // Draw the red regions using a single path to avoid overlaps
        if (this.extends.left > 0 || this.extends.right > 0 || 
            this.extends.top > 0 || this.extends.bottom > 0) {
            
            // Create a path for the entire outpaint area
            ctx.beginPath();
            
            // Start with the outer rectangle
            ctx.rect(
                this.image.x - this.extends.left,
                this.image.y - this.extends.top,
                this.image.width + this.extends.left + this.extends.right,
                this.image.height + this.extends.top + this.extends.bottom
            );
            
            // Cut out the inner rectangle (non-outpainted area)
            ctx.rect(
                this.image.x + overlaps.left,
                this.image.y + overlaps.top,
                this.image.width - (overlaps.left + overlaps.right),
                this.image.height - (overlaps.top + overlaps.bottom)
            );
            
            // Use "evenodd" fill rule to create the outline
            ctx.fill('evenodd');
        }
    
        ctx.restore();
    }

    getMaskCanvas() {
        this.updateCanvasSize();
        
        // When previewing, always use direct rendering
        if (this.canvasState.isPreviewingMask) {
            return this.canvas;
        }
        
        // For normal rendering, apply feathering if enabled
        if (!CONFIG.PAINT.FEATHER.ENABLED || CONFIG.PAINT.FEATHER.RADIUS === 0) {
            return this.canvas;
        }
        
        // If feathering is enabled, use MaskRenderer
        const maskRenderer = new MaskRenderer();
        return maskRenderer.renderMask(this.image.image, this.canvas);
    }
}