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
    print("Client connected", file=sys.stderr)

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected", file=sys.stderr)

@socketio.on('ping')
def handle_ping():
    emit('pong')

@socketio.on('mask_preview')
def handle_mask_preview(data):
    # Get base64 data after the "data:image/png;base64," prefix
    image_data = data['mask'].split(',')[1]
    # Convert base64 to bytes
    image_bytes = base64.b64decode(image_data)
    
    # Apply Gaussian blur with received radius
    blur_radius = data.get('blurRadius', 16)  # Default to 16 if not provided
    blurred_image = apply_gaussian_blur(image_bytes, radius=blur_radius)
    
    # Convert back to base64 and emit to client
    blurred_base64 = f"data:image/png;base64,{base64.b64encode(blurred_image.getvalue()).decode('utf-8')}"
    emit('mask_preview_response', {
        'blurred_mask': blurred_base64,
        'mode': data['mode']
    })
    print(f"Blurred preview mask sent for {data['mode']} mode (blur radius: {blur_radius}px)")

import sys
from pathlib import Path

@socketio.on('mask_export')
def handle_mask_export(data):
    print("Received mask_export event with data:", data.keys(), file=sys.stderr)
    
    # Debug: Print sizes of incoming data
    mask_size = len(data.get('mask', '')) / 1024 / 1024  # Size in MB
    source_size = len(data.get('sourceImage', '')) / 1024 / 1024  # Size in MB
    print(f"Data sizes - Mask: {mask_size:.2f}MB, Source: {source_size:.2f}MB", file=sys.stderr)
    try:
        # Get current working directory
        cwd = Path.cwd()
        print(f"Current working directory: {cwd}", file=sys.stderr)

        # Validate data size (50MB limit)
        total_size = len(data.get('mask', '')) + len(data.get('sourceImage', ''))
        if total_size > 50 * 1024 * 1024:  # 50MB in bytes
            raise ValueError("Total file size exceeds 50MB limit")

        timestamp = data.get('timestamp', '')
        mode = data['mode']
        blur_radius = data.get('blurRadius', 16)  # Default to 16 if not provided
        
        # Create absolute paths for output directories
        mask_dir = cwd / 'mask_outputs'
        source_dir = cwd / 'source_outputs'
        
        # Ensure output directories exist with proper permissions
        for directory in [mask_dir, source_dir]:
            directory.mkdir(exist_ok=True, parents=True)
            print(f"Directory {directory} exists: {directory.exists()}", file=sys.stderr)
            print(f"Directory {directory} permissions: {oct(directory.stat().st_mode)}", file=sys.stderr)
        
        try:
            # Handle mask image
            mask_data = data['mask'].split(',')[1]
            mask_bytes = base64.b64decode(mask_data)
        except (IndexError, KeyError):
            raise ValueError("Invalid mask data format")
        except Exception as e:
            raise ValueError(f"Error processing mask data: {str(e)}")

        try:
            blurred_image = apply_gaussian_blur(mask_bytes, radius=blur_radius)
        except Exception as e:
            raise ValueError(f"Error applying blur: {str(e)}")
        
        # Generate filenames
        base_filename = f"{mode}_{timestamp}"
        mask_filename = f"mask_{base_filename}_{blur_radius}px.png"
        source_filename = f"source_{base_filename}.png"
        
        # Save mask image
        mask_filepath = mask_dir / mask_filename
        print(f"Attempting to save mask to: {mask_filepath}", file=sys.stderr)
        try:
            mask_filepath.write_bytes(blurred_image.getvalue())
            print(f"Mask file saved successfully. Size: {mask_filepath.stat().st_size} bytes", file=sys.stderr)
        except Exception as e:
            print(f"Error saving mask file: {str(e)}", file=sys.stderr)
            raise ValueError(f"Failed to save mask file: {str(e)}")
        
        try:
            # Handle source image
            source_data = data['sourceImage'].split(',')[1]
            source_bytes = base64.b64decode(source_data)
        except (IndexError, KeyError):
            raise ValueError("Invalid source image data format")
        except Exception as e:
            raise ValueError(f"Error processing source image: {str(e)}")

        source_filepath = source_dir / source_filename
        print(f"Attempting to save source to: {source_filepath}", file=sys.stderr)
        try:
            source_filepath.write_bytes(source_bytes)
            print(f"Source file saved successfully. Size: {source_filepath.stat().st_size} bytes", file=sys.stderr)
        except Exception as e:
            print(f"Error saving source file: {str(e)}", file=sys.stderr)
            raise ValueError(f"Failed to save source file: {str(e)}")

        # Send success response to client
        socketio.emit('mask_export_response', {
            'success': True,
            'mask_filename': mask_filename,
            'source_filename': source_filename,
            'mode': mode
        })
        print(f"Files saved:\n- Mask: {mask_filepath}\n- Source: {source_filepath}")

    except Exception as e:
        error_msg = str(e)
        print(f"Error in mask_export: {error_msg}")
        socketio.emit('mask_export_response', {
            'success': False,
            'error': error_msg
        })
    
    # Send success response to client
    emit('mask_export_response', {
        'success': True,
        'mask_filename': mask_filename,
        'source_filename': source_filename,
        'mode': mode
    })
    print(f"Files saved:\n- Mask: {mask_filepath}\n- Source: {source_filepath}")