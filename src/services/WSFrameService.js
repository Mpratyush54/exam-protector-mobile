/**
 * WSFrameService.js
 * Captures camera frames using react-native-camera-kit and sends them
 * over the existing WebSocket connection as base64 JPEG.
 */
import RNFS from 'react-native-fs';

class WSFrameService {
    constructor() {
        this.socket = null;
        this.cameraRef = null;
        this.isCapturing = false;
        this.frameCount = 0;
        this.capturing = false; // Lock to prevent overlapping captures
    }

    /**
     * Start capturing and sending frames
     * @param {object} socket - The WebSocket connection proxy
     * @param {object} cameraRef - React ref to CameraKit Camera component
     */
    start(socket, cameraRef) {
        if (this.isCapturing) {
            console.log('[WSFrame] Already capturing');
            return;
        }

        this.socket = socket;
        this.cameraRef = cameraRef;
        this.isCapturing = true;
        this.frameCount = 0;
        this.capturing = false;

        console.log('[WSFrame] Starting silent frame capture loop');
        this._captureLoop();
    }

    async _captureLoop() {
        while (this.isCapturing) {
            if (!this.capturing) {
                await this._captureAndSend();
            }
            // ~5 FPS target, but adaptive: waits for capture to finish first
            await new Promise(r => setTimeout(r, 200));
        }
    }

    async _captureAndSend() {
        if (!this.isCapturing || !this.cameraRef?.current) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        if (this.capturing) return; // Skip if previous capture still in progress

        this.capturing = true;

        try {
            // Capture silently (shutter sound patched out of native code)
            const result = await this.cameraRef.current.capture({
                quality: 0.3, // Low quality = smaller files = faster
            });

            if (!result?.uri) {
                this.capturing = false;
                return;
            }

            // Get file path
            let filePath = result.uri.replace('file://', '');

            // Read as base64 and send
            const base64Data = await RNFS.readFile(filePath, 'base64');

            const payload = JSON.stringify({
                type: 'VIDEO_FRAME',
                data: { image: base64Data }
            });
            this.socket.send(payload);

            this.frameCount++;
            if (this.frameCount === 1) {
                console.log('[WSFrame] ✅ First frame sent!');
            } else if (this.frameCount % 50 === 0) {
                console.log(`[WSFrame] Sent ${this.frameCount} frames`);
            }

            // Clean up temp file (fire and forget)
            RNFS.unlink(filePath).catch(() => { });

        } catch (err) {
            if (this.frameCount % 30 === 0) {
                console.log(`[WSFrame] Error: ${err.message}`);
            }
        }

        this.capturing = false;
    }

    stop() {
        console.log(`[WSFrame] Stopped (${this.frameCount} frames sent)`);
        this.isCapturing = false;
        this.socket = null;
        this.cameraRef = null;
        this.frameCount = 0;
        this.capturing = false;
    }
}

export default new WSFrameService();
