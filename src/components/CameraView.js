import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { BatteryCharging, EyeOff, RefreshCcw } from 'lucide-react-native';
import SystemSetting from 'react-native-system-setting';

const CameraStream = forwardRef(({ isActive, cameraType = 'front', onToggleCamera }, ref) => {
    const cameraRef = useRef(null);

    // Expose camera ref to parent for frame capture
    useImperativeHandle(ref, () => ({
        capture: async (options) => {
            if (cameraRef.current) {
                return await cameraRef.current.capture(options);
            }
            return null;
        },
        getCameraRef: () => cameraRef,
    }));

    /* ---------------- BATTERY SAVER (Brightness) ---------------- */
    useEffect(() => {
        let originalBrightness = null;

        if (isActive) {
            (async () => {
                try {
                    originalBrightness = await SystemSetting.getBrightness();
                    await SystemSetting.setBrightness(0.01);
                } catch (e) {
                    console.log('Brightness control error:', e);
                }
            })();
        }

        return () => {
            if (originalBrightness !== null) {
                SystemSetting.setBrightness(originalBrightness).catch(() => { });
            }
        };
    }, [isActive]);

    const isFront = cameraType === 'front';

    return (
        <View style={styles.container}>
            {/* Camera-Kit Camera (always used - works with WS fallback) */}
            <Camera
                ref={cameraRef}
                style={styles.camera}
                cameraType={cameraType}
                flashMode="off"
            />

            {/* Camera switch button (desk view = rear, room view = front) */}
            <TouchableOpacity
                style={styles.camSwitch}
                onPress={() => onToggleCamera && onToggleCamera()}
            >
                <RefreshCcw size={18} color="#fff" />
                <Text style={styles.camSwitchText}>
                    {isFront ? 'DESK VIEW' : 'ROOM VIEW'}
                </Text>
            </TouchableOpacity>

            {/* BLACKOUT UI */}
            <View style={styles.blackoutLayer}>
                <View style={styles.statusRow}>
                    <BatteryCharging size={22} color="#22c55e" />
                    <Text style={styles.saverText}>MONITORING ACTIVE</Text>
                </View>

                <View style={styles.centerInfo}>
                    <EyeOff size={46} color="#444" />
                    <Text style={styles.dimText}>Screen dimmed</Text>
                    <Text style={styles.subText}>
                        Camera & Mic Live
                    </Text>
                </View>
            </View>
        </View>
    );
});

export default CameraStream;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    camSwitch: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        zIndex: 10,
    },
    camSwitchText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    text: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50,
    },
    blackoutLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusRow: {
        position: 'absolute',
        top: 24,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.7,
    },
    saverText: {
        color: '#22c55e',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    centerInfo: {
        alignItems: 'center',
        opacity: 0.45,
    },
    dimText: {
        color: '#666',
        marginTop: 14,
        fontSize: 14,
    },
    subText: {
        color: '#444',
        fontSize: 10,
        marginTop: 4,
    },
});
