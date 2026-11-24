import RNFS from 'react-native-fs';

const INITIAL_DELAY_MS = 1000;
const INTERVAL_MS = 250;
const MAX_BUFFERED_BYTES = 512 * 1024;
const BYTES_PER_SECOND = 512 * 1024;
const MAX_MESSAGE_BYTES = 10_000_000;

class WSFrameService {
    start(socket, capture, getCameraType, onStatus) {
        this.stop();
        let stopped = false;
        let timer;
        let watchdog;
        let lastStatus;
        const update = status => {
            if (stopped || status === lastStatus) return;
            lastStatus = status;
            onStatus(status);
        };
        const run = async () => {
            let filePath;
            let delay = INTERVAL_MS;
            try {
                if (socket.readyState !== WebSocket.OPEN) return;
                if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
                    update('Limited bandwidth');
                    return;
                }
                const camera = getCameraType();
                watchdog = setTimeout(() => update('Capture stalled'), 4000);
                const image = await capture();
                clearTimeout(watchdog);
                if (!image?.uri) {
                    update('Waiting for camera');
                    return;
                }
                filePath = image.uri.replace(/^file:\/\//, '');
                if (stopped || camera !== getCameraType()) return;
                const base64 = await RNFS.readFile(filePath, 'base64');
                if (!stopped && camera === getCameraType() && socket.readyState === WebSocket.OPEN) {
                    const payload = JSON.stringify({ type: 'VIDEO_FRAME', data: { image: base64, camera } });
                    delay = Math.max(delay, Math.ceil(payload.length * 1000 / BYTES_PER_SECOND));
                    if (payload.length > MAX_MESSAGE_BYTES) {
                        update('Frame exceeds receiver limit');
                        return;
                    }
                    socket.send(payload);
                    update('Sending frames');
                }
            } catch {
                update('Capture unavailable · retrying');
            } finally {
                clearTimeout(watchdog);
                if (filePath) await RNFS.unlink(filePath).catch(() => {});
                if (!stopped) timer = setTimeout(run, delay);
            }
        };

        this.cancel = () => {
            stopped = true;
            clearTimeout(timer);
            clearTimeout(watchdog);
        };
        timer = setTimeout(run, INITIAL_DELAY_MS);
    }

    stop() {
        this.cancel?.();
        this.cancel = null;
    }
}

export default new WSFrameService();
