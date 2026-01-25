import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../../utils/config';

class SocketService {
    private socket: Socket | null = null;

    connect() {
        if (this.socket?.connected) return;

        const token = localStorage.getItem('accessToken');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Use base URL (without /v1) for socket connection if possible, or just same host
        // Our server runs on same port, just different path or root.
        // If API_URL is http://localhost:3000/v1, we need http://localhost:3000
        const apiUrl = getApiUrl();
        const serverUrl = apiUrl.replace('/v1', '');

        this.socket = io(serverUrl, {
            query: { userId: user.id },
            auth: { token },
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    onReceiveMessage(callback: (message: any) => void) {
        if (!this.socket) return;
        this.socket.on('receive_message', callback);
    }

    offReceiveMessage(callback?: (message: any) => void) {
        if (!this.socket) return;
        if (callback) {
            this.socket.off('receive_message', callback);
        } else {
            this.socket.off('receive_message');
        }
    }

    on(event: string, callback: (data: any) => void) {
        if (!this.socket) return;
        this.socket.on(event, callback);
    }

    off(event: string, callback?: (data: any) => void) {
        if (!this.socket) return;
        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
    }
}

export const socketService = new SocketService();
