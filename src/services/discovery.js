import UdpSocket from 'react-native-udp';
import { Buffer } from 'buffer';

const DISCOVERY_PORT = 5001;
const PING_MESSAGE = 'PROCTOR_DISCOVER';
const PONG_MESSAGE = 'PROCTOR_HERE';

export const discoverServer = (timeout = 4000) => {
    return new Promise((resolve) => {
        let socket;
        let closed = false;
        let timeoutId;

        const safeClose = (reason) => {
            if (closed) return;
            closed = true;
            console.log('[UDP] Closing socket:', reason);
            clearTimeout(timeoutId);
            try { socket.close(); } catch { }
        };

        try {
            socket = UdpSocket.createSocket('udp4');

            socket.bind(5001, '0.0.0.0');

            socket.on('error', (err) => {
                if (closed) return;
                console.warn('[UDP] Socket error:', err);
                // If 5001 fails (e.g. used by another app), fallback to random
                if (err.message && err.message.includes('EADDRINUSE')) {
                    safeClose('retry_random');
                    // Note: Fallback logic would need recursive call or similar, 
                    // but for now we just fail gracefully or user retries.
                }
                safeClose('error');
                resolve(null);
            });

            socket.on('message', (msg, rinfo) => {
                const text = msg.toString();
                // Handle both Response and Announcement
                if (text === 'PROCTOR_HERE' || text === 'PROCTOR_ANNOUNCE') {
                    console.log('[UDP] Server found:', rinfo.address);
                    safeClose('found');
                    resolve({ ip: rinfo.address, port: rinfo.port });
                }
            });

            socket.on('listening', () => {
                const message = Buffer.from('PROCTOR_DISCOVER');

                // 🔥 Explicit LAN broadcasts (mobile-safe)
                const targets = [
                    '255.255.255.255',
                    '192.168.1.255',
                    '192.168.0.255',
                    '10.0.0.255',
                    '192.168.43.255', // Android Hotspot default
                    '172.20.10.15',   // iOS Hotspot default
                    '192.168.137.255' // Windows Hotspot default
                ];

                console.log('[UDP] Listening on 5001 & Sending discovery packets...');

                // Send probes every 500ms
                let probeCount = 0;
                const probeInterval = setInterval(() => {
                    if (closed || probeCount > 6) {
                        clearInterval(probeInterval);
                        return;
                    }
                    probeCount++;
                    targets.forEach((ip) => {
                        try {
                            socket.send(message, 0, message.length, 5001, ip);
                        } catch (e) { }
                    });
                }, 500);

                timeoutId = setTimeout(() => {
                    clearInterval(probeInterval);
                    safeClose('timeout');
                    resolve(null);
                }, timeout);
            });

        } catch (e) {
            console.warn('[UDP] Init failed:', e);
            try { socket?.close(); } catch { }
            resolve(null);
        }
    });
};
