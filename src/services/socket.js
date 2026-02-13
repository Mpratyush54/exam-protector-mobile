/*
 * socket.js
 * Implementation of WebSocket client for Expo Go
 */
let ws = null;

// Expo Go checks:
export const checkTcpSupport = () => true; // WebSockets are always supported

export const connectSocket = (ipAddress, port = 5000) => {
    if (ws) {
        ws.close();
    }

    console.log(`WebSocket Connecting to ${ipAddress}:${port}...`);

    try {
        const url = `ws://${ipAddress}:${port}`;
        ws = new WebSocket(url);

        // We need to return an object that mimics the react-native-tcp-socket API
        // used by App.js (on('connect'), on('close'), etc.)
        // But the native WebSocket API is event-driven differently.

        // Let's create a proxy object to bridge the gap
        const socketProxy = {
            on: (event, callbackProxy) => {
                // Map familiar names to WS events
                const callback = callbackProxy;
                if (event === 'connect') {
                    if (ws.readyState === WebSocket.OPEN) callback();
                    else ws.onopen = () => { console.log("WS Open Event"); callback(); };
                }
                else if (event === 'close') ws.onclose = callback;
                else if (event === 'error') ws.onerror = callback;
                else if (event === 'data') ws.onmessage = (e) => callback(e.data);
            },
            destroy: () => ws.close(),
            write: (data) => ws.send(data), // For TCP compatibility
            send: (data) => ws.send(data),  // For WebRTCService compatibility
            get readyState() { return ws.readyState; }
        };

        ws.onopen = () => {
            console.log("WebSocket Connected!");
        };

        ws.onclose = () => {
            console.log("WebSocket Disconnected");
        };

        ws.onerror = (e) => {
            console.log("WebSocket Error:", e.message);
        };

        return socketProxy;

    } catch (e) {
        console.error("WebSocket Creation Failed:", e);
        return { on: () => { }, destroy: () => { } };
    }
};

export const sendTcpMessage = (type, data) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = JSON.stringify({ type, data });
    ws.send(payload);
};

export const disconnectSocket = () => {
    if (ws) {
        ws.close();
        ws = null;
    }
};

// Helper to get raw socket for listening
export const getSocket = () => {
    return ws; // Returns raw WebSocket instance
};
