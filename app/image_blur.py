from PIL import Image, ImageFilter
from io import BytesIO

def apply_gaussian_blur(image_bytes, radius=16):
    """
    Apply Gaussian blur to an image with specified radius.
    
    Args:
        image_bytes: Image data as bytes
        radius: Blur radius in pixels (default: 16)
    
    Returns:
        BytesIO object containing the blurred image in PNG format
    """
    # Open image from bytes
    img = Image.open(BytesIO(image_bytes))
    
    # Apply Gaussian blur
    blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
    
    # Save to BytesIO
    output = BytesIO()
    blurred.save(output, format='PNG')
    output.seek(0)
    
    return output
