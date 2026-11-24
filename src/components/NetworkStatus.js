import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function NetworkStatus({ style }) {
    const [network, setNetwork] = useState(null);
    useEffect(() => NetInfo.addEventListener(setNetwork), []);
    let status = 'Checking network';
    if (network?.isConnected === false) status = 'Device is offline';
    if (network?.isConnected) {
        if (network.type === 'wifi') status = 'Wi-Fi connected';
        else if (network.type === 'cellular') status = 'Cellular connected';
        else status = 'Network connected';
    }
    return <Text style={style}>{status}</Text>;
}
