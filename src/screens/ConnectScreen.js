import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    ActivityIndicator
} from 'react-native';

import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';

import { scanNetworkForServer } from '../utils/networkScanner';
import { Wifi, RefreshCcw } from 'lucide-react-native';
import { checkTcpSupport } from '../services/socket';
import { discoverServer } from '../services/discovery';

export default function ConnectScreen({ onConnect }) {

    const [ipAddress, setIpAddress] = useState('');
    const [scanning, setScanning] = useState(true);
    const [foundDevices, setFoundDevices] = useState([]);
    const [myIp, setMyIp] = useState('');
    const [networkState, setNetworkState] = useState(null);

    const isSupported = checkTcpSupport();

    useEffect(() => {
        startScan();
    }, []);

    // 🔥 Get Network State (replacement for expo-network)
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setNetworkState(state);
        });

        return () => unsubscribe();
    }, []);

    // 🔥 Get IP Address
    useEffect(() => {
        const fetchIp = async () => {
            try {
                const ip = await DeviceInfo.getIpAddress();
                setMyIp(ip);
            } catch (e) {
                console.log("IP fetch error:", e);
            }
        };

        fetchIp();
    }, []);

    const startScan = async () => {
        setScanning(true);
        setFoundDevices([]);

        discoverServer(3000).then(server => {
            if (server) {
                setFoundDevices(prev => {
                    if (prev.some(d => d.ip === server.ip)) return prev;
                    return [...prev, { ip: server.ip, name: `Server ${server.ip}` }];
                });
            }
        });

        await scanNetworkForServer(5000, (device) => {
            setFoundDevices(prev => {
                if (prev.some(d => d.ip === device.ip)) return prev;
                return [...prev, device];
            });
        });

        setScanning(false);
    };

    const handleConnect = (targetIp) => {
        if (!targetIp) return;
        onConnect(targetIp);
    };

    const isHotspot =
        networkState?.type === 'cellular' ||
        (myIp && (myIp.startsWith('192.168.43') || myIp.startsWith('172.20.10')));

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Connect to Device</Text>

                {scanning ? (
                    <ActivityIndicator size="small" color="#1DB954" />
                ) : (
                    <TouchableOpacity onPress={startScan}>
                        <RefreshCcw size={24} color="#1DB954" />
                    </TouchableOpacity>
                )}
            </View>

            {isHotspot && (
                <View style={styles.hotspotBanner}>
                    <Wifi size={16} color="#000" />
                    <Text style={styles.hotspotBannerText}>
                        Hotspot Mode Active 📡
                    </Text>
                </View>
            )}

            <FlatList
                data={foundDevices}
                keyExtractor={(item) => item.ip}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.deviceRow}
                        onPress={() => handleConnect(item.ip)}
                    >
                        <Text style={styles.deviceName}>{item.name}</Text>
                        <Text style={styles.deviceStatus}>{item.ip}</Text>
                    </TouchableOpacity>
                )}
            />

            <View style={styles.footer}>
                <TextInput
                    style={styles.input}
                    value={ipAddress}
                    onChangeText={setIpAddress}
                    placeholder="192.168.1.X"
                    placeholderTextColor="#535353"
                />

                <TouchableOpacity
                    style={styles.connectButton}
                    onPress={() => handleConnect(ipAddress)}
                >
                    <Text style={styles.connectButtonText}>Connect</Text>
                </TouchableOpacity>
            </View>

        </KeyboardAvoidingView>
    );
}
//  component

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Spotify Dark
        paddingTop: Platform.OS === 'android' ? 40 : 0,
    },
    header: {
        padding: 24,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#B3B3B3',
        marginTop: 4,
    },
    hotspotBanner: {
        backgroundColor: '#1DB954',
        marginHorizontal: 20,
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    hotspotBannerText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 12,
        flex: 1,
    },
    deviceListContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7,
    },
    pulseCircle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        transform: [{ scale: 0.8 }],
    },
    pulsing: {
        // Add pulse animation logic if needed, simplifed for now
    },
    emptyText: {
        color: '#B3B3B3',
        marginTop: 16,
        fontSize: 16,
    },
    retryButton: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#282828',
        borderRadius: 20,
    },
    retryText: {
        color: 'white',
        fontWeight: 'bold',
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#282828',
    },
    iconContainer: {
        width: 48,
        height: 48,
        backgroundColor: '#282828',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    laptopIcon: {
        width: 24,
        height: 16,
        borderWidth: 2,
        borderColor: '#B3B3B3',
        borderRadius: 2,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1DB954', // Spotify Green
        marginBottom: 4,
    },
    deviceStatus: {
        fontSize: 12,
        color: '#B3B3B3',
        flexDirection: 'row',
        alignItems: 'center',
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#282828',
        backgroundColor: '#121212',
    },
    footerLink: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    manualContainer: {
        gap: 12,
    },
    input: {
        backgroundColor: '#282828',
        color: 'white',
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
    },
    connectButton: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 30, // Pill shape
        alignItems: 'center',
    },
    connectButtonText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelLink: {
        color: '#B3B3B3',
        textAlign: 'center',
        marginTop: 8,
    },
});
