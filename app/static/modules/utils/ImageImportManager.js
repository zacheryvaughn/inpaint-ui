import DraggableImage from '../DraggableImage.js';

export class ImageImportManager {
    constructor(assembledInterface) {
        this.interface = assembledInterface;
        this.setupImageImport();
    }

    setupImageImport() {
        const importButton = document.getElementById('import-operation');
        const imageInput = document.getElementById('imageInput');
        
        importButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => this.handleImageImport(e));
    }

    handleImageImport(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate dimensions that are divisible by 8
                    const newWidth = Math.floor(img.naturalWidth / 8) * 8;
                    const newHeight = Math.floor(img.naturalHeight / 8) * 8;
                    
                    // Create a temporary canvas for cropping
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = newWidth;
                    tempCanvas.height = newHeight;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Draw the image centered in the new dimensions
                    tempCtx.drawImage(img, 
                        0, 0, img.naturalWidth, img.naturalHeight,  // Source rect
                        0, 0, newWidth, newHeight                   // Dest rect
                    );
                    
                    // Convert the cropped canvas to a data URL
                    const croppedImageUrl = tempCanvas.toDataURL('image/png');
                    
                    // Create new DraggableImage with the cropped image
                    const newImage = new DraggableImage(croppedImageUrl, this.interface);
                    newImage.setMode(this.interface.currentMode);
                    this.interface.images.push(newImage);
                    this.interface.scheduleRedraw();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    }
}