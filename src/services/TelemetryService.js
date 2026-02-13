import TcpSocket from 'react-native-tcp-socket';
import { setUpdateIntervalForType, SensorTypes, accelerometer, gyroscope, magnetometer } from 'react-native-sensors';

class TelemetryService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.subscriptions = [];
        setUpdateIntervalForType(SensorTypes.accelerometer, 500); // 2Hz
        setUpdateIntervalForType(SensorTypes.gyroscope, 500);
    }

    connect(ip, port = 5001) {
        if (this.client) {
            this.disconnect();
        }

        console.log(`[Telemetry] Connecting to TCP ${ip}:${port}...`);

        this.client = TcpSocket.createConnection({
            port: port,
            host: ip,
        }, () => {
            console.log('[Telemetry] Connected!');
            this.isConnected = true;
            this.startSensors();
        });

        this.client.on('error', (error) => {
            console.log('[Telemetry] Error:', error);
            this.isConnected = false;
        });

        this.client.on('close', () => {
            console.log('[Telemetry] Connection closed');
            this.isConnected = false;
            this.stopSensors();
        });
    }

    startSensors() {
        // Start listening to sensors
        const sub1 = accelerometer.subscribe(({ x, y, z }) => {
            this.sendData({
                type: 'ACCELEROMETER',
                timestamp: Date.now(),
                data: { x, y, z }
            });
        });

        const sub2 = gyroscope.subscribe(({ x, y, z }) => {
            this.sendData({
                type: 'GYROSCOPE',
                timestamp: Date.now(),
                data: { x, y, z }
            });
        });

        this.subscriptions.push(sub1, sub2);
    }

    stopSensors() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }

    sendData(data) {
        if (!this.isConnected || !this.client) return;

        try {
            // Newline delimited JSON for the Python TCP server
            const payload = JSON.stringify(data) + '\n';
            this.client.write(payload);
        } catch (e) {
            console.warn('[Telemetry] Send failed:', e);
        }
    }

    disconnect() {
        this.stopSensors();
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        this.isConnected = false;
    }
}

export default new TelemetryService();
