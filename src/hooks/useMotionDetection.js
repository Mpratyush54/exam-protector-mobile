import { useEffect, useRef } from 'react';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { sendTcpMessage, getSocket } from '../services/socket';

export const useMotionDetection = (isActive) => {

    const subscriptionRef = useRef(null);
    const lastAlertTime = useRef(0);
    const historyRef = useRef([]);

    const ALERT_COOLDOWN = 3000; // 3 sec cooldown

    const subscribe = () => {
        setUpdateIntervalForType(SensorTypes.accelerometer, 300);

        subscriptionRef.current = accelerometer.subscribe({
            next: (data) => {
                checkMotion(data);
            },
            error: (e) => console.warn("Accelerometer error:", e)
        });
    };

    const unsubscribe = () => {
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }
    };

    const checkMotion = ({ x, y, z }) => {

        const magnitude = Math.sqrt(x * x + y * y + z * z);

        // Track last 10 samples
        historyRef.current.push(magnitude);
        if (historyRef.current.length > 10) {
            historyRef.current.shift();
        }

        if (historyRef.current.length < 10) return;

        // Calculate variance
        const mean =
            historyRef.current.reduce((a, b) => a + b, 0) /
            historyRef.current.length;

        const variance =
            historyRef.current.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            historyRef.current.length;

        const now = Date.now();

        // Detect shaking or lift
        if (
            variance > 0.8 ||              // shaking
            Math.abs(magnitude - 9.81) > 3 // strong lift
        ) {
            if (now - lastAlertTime.current > ALERT_COOLDOWN) {
                lastAlertTime.current = now;

                const socket = getSocket();
                if (socket) {
                    sendTcpMessage('ALERT', {
                        type: 'PHONE_MOVEMENT',
                        variance,
                        magnitude
                    });
                }
            }
        }
    };

    useEffect(() => {
        if (isActive) subscribe();
        else unsubscribe();

        return () => unsubscribe();
    }, [isActive]);
};
