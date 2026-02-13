import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Network as NetworkIcon, Wifi, Smartphone } from 'lucide-react-native';

export default function NetworkStatus() {
    const [networkState, setNetworkState] = useState(null);
    const [ipAddress, setIpAddress] = useState('');

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setNetworkState(state);
            setIpAddress(state.details?.ipAddress || 'N/A');
        });

        // Initial fetch
        NetInfo.fetch().then(state => {
            setNetworkState(state);
            setIpAddress(state.details?.ipAddress || 'N/A');
        });

        return () => unsubscribe();
    }, []);

    if (!networkState) return <Text style={styles.loading}>Loading network...</Text>;

    const isWifi = networkState.type === 'wifi';
    const isCellular = networkState.type === 'cellular';

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.label}>Network Integrity</Text>
                {networkState.isConnected ? (
                    <View style={styles.badgeSuccess}>
                        <Text style={styles.badgeText}>Connected</Text>
                    </View>
                ) : (
                    <View style={styles.badgeError}>
                        <Text style={styles.badgeText}>Offline</Text>
                    </View>
                )}
            </View>

            <View style={styles.row}>
                {isWifi ? <Wifi size={20} color="#34D399" /> : <Smartphone size={20} color="#FBBF24" />}
                <Text style={styles.value}>
                    {isWifi ? 'Wi-Fi' : isCellular ? 'Cellular Data' : 'Unknown'}
                </Text>
            </View>

            <Text style={styles.ip}>IP: {ipAddress}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#000', // Pure Black
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333', // Subtle border
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    label: {
        color: '#666', // Darker Grey
        fontSize: 14,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    value: {
        color: '#444', // Very dark grey, barely visible
        fontWeight: '500',
        fontSize: 16,
    },
    ip: {
        color: '#333', // Almost invisible
        fontSize: 12,
        marginTop: 4,
    },
    badgeSuccess: {
        backgroundColor: '#112211', // Very dark green
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1e3a1e'
    },
    badgeError: {
        backgroundColor: '#221111',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: '#15803d', // Dark Green Text
        fontSize: 12,
        fontWeight: 'bold',
    },
    loading: {
        color: '#666',
        fontSize: 14,
    },
});
