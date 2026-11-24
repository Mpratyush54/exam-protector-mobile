import {
    accelerometer,
    gyroscope,
    magnetometer,
    SensorTypes,
    setUpdateIntervalForType,
} from 'react-native-sensors';
import NetInfo from '@react-native-community/netinfo';
import AudioRecord from 'react-native-audio-record';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { sendTcpMessage } from './socket';

class LockdownService {
    startMonitoring(onMotionState) {
        this.stopMonitoring();
        this.subscriptions = [];
        this.lastAlertTime = 0;
        this.samples = [];
        this.telemetry = { acc: null, gyro: null, mag: null, audioLevel: null, networkState: null, touchCount: 0 };

        const channels = [
            { key: 'acc', source: accelerometer, type: SensorTypes.accelerometer, interval: 200 },
            { key: 'gyro', source: gyroscope, type: SensorTypes.gyroscope, interval: 300 },
            { key: 'mag', source: magnetometer, type: SensorTypes.magnetometer, interval: 500 },
        ];
        const states = new Map(channels.map(({ key }) => [key, 'waiting']));
        const update = (key, state) => {
            if (this.motionStates !== states || states.get(key) === state) return;
            states.set(key, state);
            const values = [...states.values()];
            if (values.every(value => value === 'unavailable')) onMotionState('Sensors unavailable');
            else if (values.includes('unavailable')) onMotionState('Some sensors unavailable');
            else if (values.every(value => value === 'active')) onMotionState('Sampling sensors');
        };
        this.motionStates = states;

        for (const { key, source, type, interval } of channels) {
            try {
                setUpdateIntervalForType(type, interval);
                this.subscriptions.push(source.subscribe({
                    next: data => {
                        if (this.motionStates !== states) return;
                        this.telemetry[key] = data;
                        update(key, 'active');
                        if (key === 'acc') this.detectMotionAnomaly(data);
                    },
                    error: () => update(key, 'unavailable'),
                }));
            } catch {
                update(key, 'unavailable');
            }
        }
        this.sensorTimeout = setTimeout(() => {
            for (const [key, state] of states) {
                if (state === 'waiting') update(key, 'unavailable');
            }
        }, 5000);
        this.networkUnsubscribe = NetInfo.addEventListener(({ type, isConnected }) => {
            if (this.motionStates !== states) return;
            const previous = this.telemetry.networkState;
            this.telemetry.networkState = { type, isConnected };
            if (previous && previous.type !== type && !['wifi', 'ethernet'].includes(type)) {
                this.sendAlert('NETWORK_SWITCH', { detail: type });
            }
        });
        this.packetInterval = setInterval(() => {
            if (sendTcpMessage('TELEMETRY', { ...this.telemetry, timestamp: Date.now() })) {
                this.telemetry.touchCount = 0;
            }
        }, 1000);
    }

    startAudioMeter(onLevel) {
        if (this.audioSubscription) return;
        const filename = `phone-proctor-meter-${Date.now()}.wav`;
        AudioRecord.init({
            sampleRate: 16000, channels: 1, bitsPerSample: 16, audioSource: 6, wavFile: filename,
        });
        let reportedLevel = false;
        this.audioSubscription = AudioRecord.on('data', encoded => {
            if (!encoded || !this.telemetry) return;
            const chunk = Buffer.from(encoded, 'base64');
            const count = Math.floor(chunk.length / 2);
            if (!count) return;
            let sumSquares = 0;
            for (let index = 0; index < count; index++) {
                const sample = chunk.readInt16LE(index * 2);
                sumSquares += sample * sample;
            }
            this.telemetry.audioLevel = Math.min(Math.sqrt(sumSquares / count) / 32767, 1);
            if (!reportedLevel) {
                reportedLevel = true;
                onLevel();
            }
        });
        AudioRecord.start();
    }

    stopAudioMeter() {
        if (!this.audioSubscription) return;
        this.audioSubscription.remove();
        this.audioSubscription = null;
        if (this.telemetry) this.telemetry.audioLevel = null;
        try {
            Promise.resolve(AudioRecord.stop()).then(path => {
                if (path) return RNFS.unlink(path);
            }).catch(() => {});
        } catch {}
    }

    stopMonitoring() {
        this.motionStates = null;
        this.subscriptions?.forEach(subscription => subscription.unsubscribe());
        this.subscriptions = [];
        this.networkUnsubscribe?.();
        this.networkUnsubscribe = null;
        clearTimeout(this.sensorTimeout);
        clearInterval(this.packetInterval);
        this.stopAudioMeter();
        this.telemetry = null;
    }

    reportTouch(event) {
        if (!this.telemetry) return;
        this.telemetry.touchCount++;
        this.sendAlert('TOUCH_DETECTED', {
            x: event.nativeEvent.locationX,
            y: event.nativeEvent.locationY,
        });
    }

    sendAlert(type, payload) {
        const now = Date.now();
        if (now - this.lastAlertTime < 3000) return;
        if (sendTcpMessage('ALERT', { type, ...payload, timestamp: now })) this.lastAlertTime = now;
    }

    detectMotionAnomaly({ x, y, z }) {
        const magnitude = Math.hypot(x, y, z);
        this.samples.push(magnitude);
        if (this.samples.length > 15) this.samples.shift();
        if (this.samples.length < 10) return;

        const mean = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
        const variance = this.samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / this.samples.length;
        if (variance > 0.8) this.sendAlert('PHONE_SHAKING', { variance });
        if (Math.abs(magnitude - 9.81) > 3) this.sendAlert('PHONE_LIFTED', { magnitude });
    }
}

export const lockdownService = new LockdownService();
