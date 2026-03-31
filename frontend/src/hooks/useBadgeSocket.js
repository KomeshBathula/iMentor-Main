// frontend/src/hooks/useBadgeSocket.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

// Connect to the same origin so Vite's proxy forwards /socket.io → backend (avoids PNA/CORS issues)
const SOCKET_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';

export const useBadgeSocket = () => {
    const { user } = useAuth();
    const [newBadge, setNewBadge] = useState(null);

    useEffect(() => {
        if (!user || !user.id) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 2000
        });

        const isDev = import.meta.env.DEV;

        socket.on('connect', () => {
            if (isDev) {
                console.log('[Socket] Connected to server at:', SOCKET_URL);
                console.log('[Socket] Joining room for user ID:', user.id);
            }
            socket.emit('join', user.id);
        });

        socket.on('joined', (data) => {
            if (isDev) {
                console.log('[Socket] Successfully joined room:', data.room);
            }
        });

        socket.on('badge_earned', (badge) => {
            if (isDev) {
                console.log('[Socket] 🏆 Badge earned!', badge);
            }
            setNewBadge(badge);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });

        socket.on('disconnect', (reason) => {
            if (isDev) {
                console.log('[Socket] Disconnected from server:', reason);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user]);

    const clearBadge = () => setNewBadge(null);

    return { newBadge, clearBadge };
};
