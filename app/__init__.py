from flask import Flask
from flask_socketio import SocketIO

socketio = SocketIO()

def create_app():
    app = Flask(__name__)
    
    from app.routes_events import main
    app.register_blueprint(main)
    
    socketio.init_app(app)
    return app