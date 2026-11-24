import React, { useEffect, useRef, useState } from 'react';
import {
    Linking, NativeModules, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { AudioLines, Camera, Radio, ShieldCheck, Wifi } from 'lucide-react-native';
import KeepAwake from 'react-native-keep-awake';
import ConnectScreen from './src/screens/ConnectScreen';
import CameraStream from './src/components/CameraView';
import NetworkStatus from './src/components/NetworkStatus';
import { connectSocket, disconnectSocket } from './src/services/socket';
import { lockdownService } from './src/services/LockdownService';
import WebRTCService from './src/services/WebRTCService';
import WSFrameService from './src/services/WSFrameService';
import { palette, ui } from './src/theme';

async function requestCamera() {
    if (Platform.OS === 'android') {
        return await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
            === PermissionsAndroid.RESULTS.GRANTED;
    }
    return NativeModules.CKCameraManager.requestDeviceCameraAuthorization();
}

function stopAttempt(attempt) {
    attempt.active = false;
    clearTimeout(attempt.connectTimeout);
    clearTimeout(attempt.audioTimeout);
    disconnectSocket();
    WSFrameService.stop();
    WebRTCService.stop();
    lockdownService.stopMonitoring();
}

export default function App() {
    const [connection, setConnection] = useState({ kind: 'idle' });
    const [cameraPermission, setCameraPermission] = useState('Checking permission');
    const [video, setVideo] = useState('Waiting for camera');
    const [audio, setAudio] = useState('Starting microphone');
    const [motion, setMotion] = useState('Waiting for sensors');
    const [cameraType, setCameraType] = useState('front');
    const [cameraRevision, setCameraRevision] = useState(0);
    const [settingsError, setSettingsError] = useState(false);
    const lens = useRef('front');
    const attemptRef = useRef(null);
    const cameraRef = useRef(null);

    useEffect(() => () => {
        if (attemptRef.current) stopAttempt(attemptRef.current);
    }, []);

    function changeCamera(type) {
        lens.current = type;
        setCameraType(type);
    }

    function finish(attempt, message) {
        if (!attempt?.active) return;
        stopAttempt(attempt);
        attemptRef.current = null;
        setConnection({ kind: message ? 'error' : 'idle', address: attempt.address, message });
    }

    useEffect(() => {
        const attempt = attemptRef.current;
        if (connection.kind !== 'connected' || cameraPermission !== 'granted' || !attempt?.active) return;
        setVideo('Waiting for camera');
        WSFrameService.start(attempt.socket, () => cameraRef.current?.capture(), () => lens.current, setVideo);
        return () => WSFrameService.stop();
    }, [connection, cameraPermission, cameraType, cameraRevision]);

    async function startMonitoring(attempt, socket) {
        lockdownService.startMonitoring(setMotion);
        try {
            const allowed = await requestCamera();
            if (!attempt.active) return;
            setCameraPermission(allowed ? 'granted' : 'Camera permission denied');
        } catch {
            if (attempt.active) setCameraPermission('Camera permission unavailable');
        }
        if (!attempt.active) return;

        try {
            if (Platform.OS === 'android') {
                const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (!attempt.active) return;
                if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
                    setAudio('Microphone permission denied');
                    return;
                }
            }
            const fallback = () => {
                if (!attempt.active || attempt.usingAudioMeter) return;
                attempt.usingAudioMeter = true;
                clearTimeout(attempt.audioTimeout);
                WebRTCService.stop();
                attempt.audioTimeout = setTimeout(() => {
                    lockdownService.stopAudioMeter();
                    setAudio('Audio unavailable');
                }, 4000);
                setAudio('Starting sound level meter');
                try {
                    lockdownService.startAudioMeter(() => {
                        clearTimeout(attempt.audioTimeout);
                        setAudio('Sending sound levels');
                    });
                } catch {
                    clearTimeout(attempt.audioTimeout);
                    lockdownService.stopAudioMeter();
                    setAudio('Audio unavailable');
                }
            };
            attempt.audioTimeout = setTimeout(fallback, 12000);
            attempt.audioFallback = fallback;
            void WebRTCService.start(socket, state => {
                if (!attempt.active) return;
                if (state === 'Audio unavailable') fallback();
                else {
                    clearTimeout(attempt.audioTimeout);
                    setAudio(state);
                }
            });
        } catch {
            if (attempt.active) setAudio('Microphone unavailable');
        }
    }

    function handleConnect(address) {
        if (attemptRef.current) return;
        const attempt = { address, active: true };
        attemptRef.current = attempt;
        setConnection({ kind: 'connecting', address });
        try {
            const socket = connectSocket(address);
            attempt.socket = socket;
            attempt.connectTimeout = setTimeout(
                () => finish(attempt, 'The computer did not respond. Check the address and try again.'), 8000,
            );
            socket.onopen = () => {
                if (!attempt.active) return;
                clearTimeout(attempt.connectTimeout);
                setCameraPermission('Checking permission');
                setVideo('Waiting for camera');
                setAudio('Starting microphone');
                setMotion('Waiting for sensors');
                setSettingsError(false);
                changeCamera('front');
                setConnection({ kind: 'connected', address });
                void startMonitoring(attempt, socket).catch(() => {
                    if (attempt.active) finish(attempt, 'Monitoring could not start. Reconnect to try again.');
                });
            };
            socket.onerror = () => finish(attempt, 'Unable to reach the exam computer. Check your network and try again.');
            socket.onclose = () => finish(attempt, 'Connection closed. Reconnect to resume monitoring.');
            socket.onmessage = ({ data }) => {
                if (!attempt.active) return;
                let message;
                try { message = JSON.parse(data); } catch { return; }
                if (message?.type === 'WEBRTC_ANSWER') {
                    void WebRTCService.handleAnswer(message.data).catch(() => attempt.audioFallback?.());
                }
                if (message?.type === 'SET_CAMERA' && ['front', 'back'].includes(message.data?.camera)) {
                    changeCamera(message.data.camera);
                }
            };
        } catch {
            finish(attempt, 'Connection could not be opened. Check the computer address.');
        }
    }

    const connected = connection.kind === 'connected';
    return (
        <SafeAreaView style={ui.page}>
            <StatusBar barStyle="dark-content" backgroundColor={palette.page} />
            <View style={styles.header}>
                <View style={ui.mark}><ShieldCheck color="white" size={19} /></View>
                <Text style={ui.brandText}>Phone-Proctor</Text>
            </View>
            {connected ? (
                <View style={ui.page} onTouchStart={event => lockdownService.reportTouch(event)}>
                    <KeepAwake />
                    <ScrollView contentContainerStyle={ui.content}>
                        <View style={styles.intro}>
                            <Text accessibilityRole="header" style={ui.heading}>Monitoring</Text>
                            <Text style={ui.body}>Connected to {connection.address}</Text>
                        </View>
                        <View style={ui.section}>
                            <View style={ui.row}>
                                <Text style={[ui.label, ui.grow]}>{cameraType === 'front' ? 'Room view' : 'Desk view'}</Text>
                                {cameraPermission === 'granted' && <TouchableOpacity accessibilityRole="button"
                                    style={ui.secondary} onPress={() => changeCamera(cameraType === 'front' ? 'back' : 'front')}>
                                    <Text style={ui.secondaryText}>Switch camera</Text>
                                </TouchableOpacity>}
                            </View>
                            {cameraPermission === 'granted' ? <CameraStream key={`${cameraType}:${cameraRevision}`} ref={cameraRef} cameraType={cameraType} /> :
                                <Text accessibilityLiveRegion="polite" style={ui.body}>{cameraPermission}</Text>}
                            {video === 'Capture stalled' && <TouchableOpacity accessibilityRole="button" style={ui.secondary}
                                onPress={() => {
                                    setCameraRevision(revision => revision + 1);
                                }}>
                                <Text style={ui.secondaryText}>Restart camera</Text>
                            </TouchableOpacity>}
                        </View>
                        <View>
                            <Text accessibilityRole="header" style={ui.sectionLabel}>Monitoring signals</Text>
                            <Signal icon={Camera} label="Camera" status={cameraPermission === 'granted' ? video : cameraPermission}
                                active={video === 'Sending frames'} />
                            <Signal icon={AudioLines} label="Microphone" status={audio}
                                active={['Streaming audio', 'Sending sound levels'].includes(audio)} />
                            <Signal icon={Radio} label="Motion" status={motion} active={motion === 'Sampling sensors'} />
                            <View style={ui.item}>
                                <View style={ui.icon}><Wifi color="white" size={17} /></View>
                                <View style={ui.grow}>
                                    <Text style={ui.label}>Network</Text>
                                    <NetworkStatus style={ui.body} />
                                </View>
                            </View>
                            {(cameraPermission.includes('denied') || audio.includes('denied')) &&
                                <TouchableOpacity accessibilityRole="button" style={ui.secondary} onPress={() => {
                                    Linking.openSettings().catch(() => setSettingsError(true));
                                }}><Text style={ui.secondaryText}>Open permission settings</Text></TouchableOpacity>}
                            {settingsError && <Text style={ui.error}>Open device settings to grant access, then reconnect.</Text>}
                        </View>
                    </ScrollView>
                    <View style={ui.actionBar}>
                        <View style={ui.actionGroup}>
                            <TouchableOpacity accessibilityRole="button" style={ui.secondary}
                                onPress={() => finish(attemptRef.current)}>
                                <Text style={ui.secondaryText}>Disconnect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : (
                <ConnectScreen connection={connection} onConnect={handleConnect}
                    onCancel={() => finish(attemptRef.current)} />
            )}
        </SafeAreaView>
    );
}

function Signal({ icon: Icon, label, status, active }) {
    return (
        <View style={ui.item}>
            <View style={ui.icon}><Icon color="white" size={17} /></View>
            <View style={ui.grow}>
                <Text style={ui.label}>{label}</Text>
                <Text accessibilityLiveRegion="polite" style={[ui.body, active && styles.active]}>{status}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 24, paddingTop: 15, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
    intro: { gap: 7 },
    active: { color: palette.good },
});
