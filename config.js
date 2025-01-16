export const CONFIG = {
    CANVAS: {
        MIN_SCALE: 0.3,
        MAX_SCALE: 10,
        SCALE_STEP: 1.03,
        SCALE_RATE: 0.04,
        INITIAL_SCALE: 0.5,
        BACKGROUND_COLOR: '#1A1A1A'
    },
    GRID: {
        SMALL: {
            HIGH_ZOOM: 8,
            MEDIUM_ZOOM: 16,
            LOW_ZOOM: 32,
            COLOR: '#2A2A2A'
        },
        LARGE: {
            SIZE: 64,
            COLOR: '#3A3A3A'
        },
        ORIGIN_CROSS_SIZE: 16,
        ORIGIN_COLOR: '#DADADA'
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
            OPACITY: 0.2
        },
        BRUSH: {
            COLOR: '#FF0000', 
            OPACITY: 0.4,
            SIZE: 16
        },
        ERASER: {
            SIZE: 24
        },
        SMOOTHING_FACTOR: 8,
        FEATHER: {
            ENABLED: true,
            RADIUS: 20,
            UPDATE_DELAY: 16
        }
    }
};