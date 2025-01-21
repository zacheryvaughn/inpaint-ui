from flask import Blueprint, render_template
from flask_socketio import emit
from app import socketio

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