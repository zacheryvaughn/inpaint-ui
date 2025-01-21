from flask import Blueprint, render_template
from flask_socketio import emit
from app import socketio
import base64
import os
from io import BytesIO
from app.image_blur import apply_gaussian_blur

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print("Client connected")

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('mask_preview')
def handle_mask_preview(data):
    # Get base64 data after the "data:image/png;base64," prefix
    image_data = data['mask'].split(',')[1]
    # Convert base64 to bytes
    image_bytes = base64.b64decode(image_data)
    
    # Apply Gaussian blur with received radius
    blur_radius = data.get('blurRadius', 16)  # Default to 16 if not provided
    blurred_image = apply_gaussian_blur(image_bytes, radius=blur_radius)
    
    # Save to root directory
    with open('preview_mask.png', 'wb') as f:
        f.write(blurred_image.getvalue())
    print(f"Blurred preview mask saved for {data['mode']} mode (blur radius: {blur_radius}px)")

@socketio.on('mask_export')
def handle_mask_export(data):
    # Get base64 data after the "data:image/png;base64," prefix
    image_data = data['mask'].split(',')[1]
    # Convert base64 to bytes
    image_bytes = base64.b64decode(image_data)
    
    # Apply Gaussian blur with received radius
    blur_radius = data.get('blurRadius', 16)  # Default to 16 if not provided
    blurred_image = apply_gaussian_blur(image_bytes, radius=blur_radius)
    
    # Save to root directory
    with open('export_mask.png', 'wb') as f:
        f.write(blurred_image.getvalue())
    print(f"Blurred export mask saved for {data['mode']} mode (blur radius: {blur_radius}px)")