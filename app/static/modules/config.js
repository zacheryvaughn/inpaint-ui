export const CONFIG = {
    CANVAS: {
        MIN_SCALE: 0.3,
        MAX_SCALE: 10,
        SCALE_STEP: 1.03,
        SCALE_RATE: 0.04,
        INITIAL_SCALE: 0.5,
        BACKGROUND_COLOR: '#141415'
    },
    GRID: {
        SMALL: {
            HIGH_ZOOM: 8,
            MEDIUM_ZOOM: 16,
            LOW_ZOOM: 32,
            COLOR: '#1E1E1F'
        },
        LARGE: {
            SIZE: 64,
            COLOR: '#2B2B2C'
        },
        ORIGIN_CROSS_SIZE: 16,
        ORIGIN_COLOR: '#6D6D74'
    },
    IMAGE: {
        SNAP_SIZE: 8,
        FONT: '8px Arial',
        TEXT_COLOR: '#FFFFFF',
        TEXT_OFFSET_X: 5,
        TEXT_OFFSET_Y: 10
    },
    PAINT: {
        BACKGROUND: {
            COLOR: '#000000',
            OPACITY: 0.1
        },
        BRUSH: {
            COLOR: '#FF0000', 
            OPACITY: 0.4,
            SIZE: 32
        },
        ERASER: {
            SIZE: 48
        },
        SMOOTHING_FACTOR: 8
    },
    OUTPAINT: {
        DEFAULT_SIZE: 0,
        MIN_SIZE: 0,
        MAX_SIZE: 4096,
        DEFAULT_OVERLAP: 24,
        MIN_OVERLAP: 8,
        MAX_OVERLAP: 128
    }
};