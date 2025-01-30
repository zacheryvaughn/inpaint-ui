from flask import Flask
from flask_socketio import SocketIO

socketio = SocketIO(max_http_buffer_size=100 * 1024 * 1024)  # 100MB buffer size

def create_app():
    app = Flask(__name__)
    
    from app.routes_events import main
    app.register_blueprint(main)
    
    socketio.init_app(app)
    return app