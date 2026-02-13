import {
    accelerometer,
    gyroscope,
    magnetometer,
    SensorTypes,
    setUpdateIntervalForType
} from 'react-native-sensors';

import NetInfo from '@react-native-community/netinfo';
import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { sendTcpMessage } from '../services/socket';

class LockdownService {
    constructor() {
        this.subscriptions = [];
        this.audioInterval = null;
        this.packetInterval = null;
        this.networkUnsubscribe = null;

        this.lastAlertTime = 0;
        this.ALERT_COOLDOWN = 3000; // 3 seconds

        this.telemetry = {
            acc: { x: 0, y: 0, z: 0 },
            gyro: { x: 0, y: 0, z: 0 },
            mag: { x: 0, y: 0, z: 0 },
            audioLevel: -160,
            networkState: null,
            touchCount: 0,
        };

        this.history = {
            accMagnitude: []
        };
    }

    async requestAudioPermission() {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'Microphone access required for proctoring',
                        buttonPositive: 'OK'
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    }

    async startMonitoring() {
        console.log("Starting Lockdown Monitoring...");

        // 1️⃣ Accelerometer
        try {
            setUpdateIntervalForType(SensorTypes.accelerometer, 200);

            const subAcc = accelerometer.subscribe({
                next: data => {
                    this.telemetry.acc = data;
                    this.detectMotionAnomaly(data);
                },
                error: e => console.warn("Accelerometer error:", e)
            });

            this.subscriptions.push(subAcc);
        } catch (e) {
            console.warn("Accelerometer failed:", e);
        }

        // 2️⃣ Gyroscope
        try {
            setUpdateIntervalForType(SensorTypes.gyroscope, 300);

            const subGyro = gyroscope.subscribe({
                next: data => {
                    this.telemetry.gyro = data;
                },
                error: e => console.warn("Gyroscope error:", e)
            });

            this.subscriptions.push(subGyro);
        } catch (e) {
            console.warn("Gyroscope failed:", e);
        }

        // 3️⃣ Magnetometer
        try {
            setUpdateIntervalForType(SensorTypes.magnetometer, 500);

            const subMag = magnetometer.subscribe({
                next: data => {
                    this.telemetry.mag = data;
                },
                error: e => console.warn("Magnetometer error:", e)
            });

            this.subscriptions.push(subMag);
        } catch (e) {
            console.warn("Magnetometer failed:", e);
        }

        // 4️⃣ Audio Monitoring
        try {
            const hasPermission = await this.requestAudioPermission();
            if (hasPermission) {
                const options = {
                    sampleRate: 16000,
                    channels: 1,
                    bitsPerSample: 16,
                    audioSource: 6,
                    wavFile: 'temp.wav'
                };

                AudioRecord.init(options);
                AudioRecord.start();

                this.audioInterval = setInterval(() => {
                    // Placeholder level
                    this.telemetry.audioLevel = -160;
                }, 500);
            }
        } catch (e) {
            console.warn("Audio monitoring failed:", e);
        }

        // 5️⃣ Network Monitoring
        this.networkUnsubscribe = NetInfo.addEventListener(state => {
            this.telemetry.networkState = state;

            if (state.type !== 'wifi' && state.type !== 'ethernet') {
                this.sendAlert('NETWORK_SWITCH', { detail: state.type });
            }
        });

        // 6️⃣ Telemetry Packet Sender
        this.packetInterval = setInterval(() => {
            this.sendTelemetry();
        }, 1000);
    }

    stopMonitoring() {
        console.log("Stopping Lockdown Monitoring...");

        this.subscriptions.forEach(sub => sub?.unsubscribe());
        this.subscriptions = [];

        try {
            AudioRecord.stop();
        } catch (e) {
            console.warn("Audio stop error:", e);
        }

        if (this.audioInterval) clearInterval(this.audioInterval);
        if (this.packetInterval) clearInterval(this.packetInterval);
        if (this.networkUnsubscribe) this.networkUnsubscribe();
    }

    sendTelemetry() {
        sendTcpMessage('TELEMETRY', {
            ...this.telemetry,
            timestamp: Date.now()
        });

        this.telemetry.touchCount = 0;
    }

    reportTouch(event) {
        this.telemetry.touchCount++;

        this.sendAlert('TOUCH_DETECTED', {
            x: event.nativeEvent.locationX,
            y: event.nativeEvent.locationY
        });
    }

    sendAlert(type, payload = {}) {
        const now = Date.now();

        if (now - this.lastAlertTime < this.ALERT_COOLDOWN) return;

        this.lastAlertTime = now;

        sendTcpMessage('ALERT', {
            type,
            ...payload,
            timestamp: now
        });
    }

    detectMotionAnomaly(acc) {
        const mag = Math.sqrt(
            acc.x * acc.x +
            acc.y * acc.y +
            acc.z * acc.z
        );

        this.history.accMagnitude.push(mag);
        if (this.history.accMagnitude.length > 15)
            this.history.accMagnitude.shift();

        if (this.history.accMagnitude.length < 10) return;

        const mean =
            this.history.accMagnitude.reduce((a, b) => a + b, 0) /
            this.history.accMagnitude.length;

        const variance =
            this.history.accMagnitude.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            this.history.accMagnitude.length;

        // Detect shaking
        if (variance > 0.8) {
            this.sendAlert('PHONE_SHAKING', { variance });
        }

        // Detect lifting
        if (Math.abs(mag - 9.81) > 3) {
            this.sendAlert('PHONE_LIFTED', { magnitude: mag });
        }
    }
}

export const lockdownService = new LockdownService();
