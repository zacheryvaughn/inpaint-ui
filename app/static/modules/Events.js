export default class Events {
    constructor() {
        this.socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 60000, // Increased timeout
            maxHttpBufferSize: 100 * 1024 * 1024, // 100MB buffer size
            pingTimeout: 60000, // Increased ping timeout
            pingInterval: 25000, // More frequent pings
            transports: ['websocket', 'polling'] // Try WebSocket first, fallback to polling
        });

        // Keep-alive mechanism
        this.keepAliveInterval = setInterval(() => {
            if (this.socket.connected) {
                this.socket.emit('ping');
            }
        }, 30000);

        // Clean up interval on window unload
        window.addEventListener('unload', () => {
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
            }
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, try to reconnect
                this.socket.connect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            // Show error to user
            this.showError('Connection error. Retrying...');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showError('An error occurred. Please try again.');
        });
    }

    emit(event, data) {
        return new Promise((resolve, reject) => {
            if (!this.socket.connected) {
                const error = 'Socket not connected. Cannot emit event: ' + event;
                console.error(error);
                this.showError('Not connected to server. Please wait...');
                reject(new Error(error));
                return;
            }

            // Set timeout for response
            const timeout = setTimeout(() => {
                reject(new Error('Request timed out'));
                this.showError('Request timed out. Please try again.');
            }, 30000);

            // Emit with acknowledgment
            this.socket.emit(event, data, (response) => {
                clearTimeout(timeout);
                if (response && response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--error-red);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 5000);
    }
}