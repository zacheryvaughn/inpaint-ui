import { CONFIG } from '../config.js';

export default class MaskRenderer {
    constructor() {
        this.setupCanvases();
    }

    setupCanvases() {
        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.whiteCanvas = document.createElement('canvas');
        this.whiteCtx = this.whiteCanvas.getContext('2d');
    }

    renderMask(image, paintCanvas) {
        // Set canvas dimensions to match the image
        this.previewCanvas.width = image.naturalWidth;
        this.previewCanvas.height = image.naturalHeight;
        this.whiteCanvas.width = image.naturalWidth;
        this.whiteCanvas.height = image.naturalHeight;

        // Convert paint to white using composite operations
        this.whiteCtx.drawImage(paintCanvas, 0, 0, image.naturalWidth, image.naturalHeight);
        this.whiteCtx.globalCompositeOperation = 'source-in';
        this.whiteCtx.fillStyle = '#FFFFFF';
        this.whiteCtx.fillRect(0, 0, image.naturalWidth, image.naturalHeight);

        // Apply gaussian blur if enabled
        if (CONFIG.PAINT.FEATHER.ENABLED && CONFIG.PAINT.FEATHER.RADIUS > 0) {
            this.applyGaussianBlur();
        }

        // Draw black background
        this.previewCtx.fillStyle = '#000000';
        this.previewCtx.fillRect(0, 0, image.naturalWidth, image.naturalHeight);

        // Draw white paint on top
        this.previewCtx.drawImage(this.whiteCanvas, 0, 0);

        return this.previewCanvas;
    }

    applyGaussianBlur() {
        const imageData = this.whiteCtx.getImageData(
            0, 0,
            this.whiteCanvas.width,
            this.whiteCanvas.height
        );
        const pixels = imageData.data;
        const radius = CONFIG.PAINT.FEATHER.RADIUS;
        const width = this.whiteCanvas.width;
        const height = this.whiteCanvas.height;

        // Extract alpha channel
        const alphaChannel = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            alphaChannel[i] = pixels[i * 4 + 3];
        }

        // Create gaussian kernel
        const kernelSize = radius * 2 + 1;
        const kernel = new Float32Array(kernelSize * kernelSize);
        const sigma = radius / 3;
        const twoSigmaSquare = 2 * sigma * sigma;
        let sum = 0;

        for (let y = -radius, idx = 0; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++, idx++) {
                const exp = Math.exp(-(x * x + y * y) / twoSigmaSquare);
                kernel[idx] = exp;
                sum += exp;
            }
        }

        // Normalize kernel
        const scale = 1 / sum;
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] *= scale;
        }

        // Create gradient mask
        const gradientMask = new Float32Array(width * height);
        this.createGradientMask(alphaChannel, gradientMask, width, height);

        // Expand gradient influence
        const expandedMask = new Float32Array(width * height);
        this.expandGradientInfluence(gradientMask, expandedMask, width, height, radius);

        // Apply blur
        const blurredAlpha = new Uint8Array(width * height);
        blurredAlpha.set(alphaChannel);
        this.applyBlur(blurredAlpha, expandedMask, alphaChannel, kernel, radius, width, height);

        // Update image data
        for (let i = 0; i < width * height; i++) {
            const rgba = i * 4;
            pixels[rgba] = 255;     // White
            pixels[rgba + 1] = 255; // White
            pixels[rgba + 2] = 255; // White
            pixels[rgba + 3] = blurredAlpha[i];
        }

        this.whiteCtx.putImageData(imageData, 0, 0);
    }

    createGradientMask(alphaChannel, gradientMask, width, height) {
        for (let y = 0; y < height; y++) {
            const yOffset = y * width;
            for (let x = 0; x < width; x++) {
                const idx = yOffset + x;
                const currentAlpha = alphaChannel[idx];

                if (currentAlpha === 0 || currentAlpha === 255) continue;

                let maxGradient = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;

                    const nyOffset = ny * width;
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        if (nx < 0 || nx >= width) continue;

                        const neighborIdx = nyOffset + nx;
                        const alphaDiff = Math.abs(currentAlpha - alphaChannel[neighborIdx]);
                        maxGradient = Math.max(maxGradient, alphaDiff);
                    }
                }

                gradientMask[idx] = maxGradient / 255;
            }
        }
    }

    expandGradientInfluence(gradientMask, expandedMask, width, height, radius) {
        const processingRadius = radius;

        for (let y = 0; y < height; y++) {
            const yOffset = y * width;
            for (let x = 0; x < width; x++) {
                const idx = yOffset + x;
                if (gradientMask[idx] > 0) {
                    const startY = Math.max(0, y - processingRadius);
                    const endY = Math.min(height - 1, y + processingRadius);
                    const startX = Math.max(0, x - processingRadius);
                    const endX = Math.min(width - 1, x + processingRadius);

                    for (let py = startY; py <= endY; py++) {
                        const pyOffset = py * width;
                        for (let px = startX; px <= endX; px++) {
                            const targetIdx = pyOffset + px;
                            const distance = Math.sqrt(
                                Math.pow(px - x, 2) + Math.pow(py - y, 2)
                            );
                            const influence = Math.max(
                                0,
                                1 - distance / processingRadius
                            ) * gradientMask[idx];
                            expandedMask[targetIdx] = Math.max(
                                expandedMask[targetIdx],
                                influence
                            );
                        }
                    }
                }
            }
        }
    }

    applyBlur(blurredAlpha, expandedMask, alphaChannel, kernel, radius, width, height) {
        for (let y = 0; y < height; y++) {
            const yOffset = y * width;
            for (let x = 0; x < width; x++) {
                if (!expandedMask[yOffset + x]) continue;

                let sum = 0;
                let kernelIndex = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    const py = Math.min(Math.max(y + ky, 0), height - 1);
                    const pyOffset = py * width;

                    for (let kx = -radius; kx <= radius; kx++) {
                        const px = Math.min(Math.max(x + kx, 0), width - 1);
                        sum += alphaChannel[pyOffset + px] * kernel[kernelIndex++];
                    }
                }

                blurredAlpha[yOffset + x] = sum;
            }
        }
    }
}