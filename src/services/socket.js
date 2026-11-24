let current = null;

export function connectSocket(address, port = 5000) {
    disconnectSocket();
    current = new WebSocket(`ws://${address}:${port}`);
    return current;
}

export function disconnectSocket() {
    const socket = current;
    current = null;
    if (socket) {
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
        socket.close();
    }
}

export function sendTcpMessage(type, data) {
    if (current?.readyState !== WebSocket.OPEN) return false;
    try {
        current.send(JSON.stringify({ type, data }));
        return true;
    } catch {
        return false;
    }
}

export function getSocket() {
    return current;
}
