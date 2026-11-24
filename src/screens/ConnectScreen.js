import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { ChevronRight, Globe, Laptop, Radar } from 'lucide-react-native';
import { discoverServer } from '../services/discovery';
import NetworkStatus from '../components/NetworkStatus';
import { palette, ui, validAddress } from '../theme';

export default function ConnectScreen({ connection, onConnect, onCancel }) {
    const [address, setAddress] = useState(connection.address ?? '');
    const [discovery, setDiscovery] = useState({ kind: 'idle' });
    const [invalid, setInvalid] = useState(false);
    const scan = useRef(null);
    const connecting = connection.kind === 'connecting';

    useEffect(() => () => scan.current?.abort(), []);

    async function search() {
        if (scan.current) return;
        const controller = new AbortController();
        scan.current = controller;
        setDiscovery({ kind: 'searching' });
        try {
            const server = await discoverServer(controller.signal);
            if (!controller.signal.aborted) setDiscovery(server ? { kind: 'found', server } : { kind: 'empty' });
        } catch {
            if (!controller.signal.aborted) setDiscovery({ kind: 'error' });
        } finally {
            if (scan.current === controller) scan.current = null;
        }
    }

    function connect(target) {
        const host = target.trim();
        if (connecting) return;
        if (!validAddress(host)) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        setAddress(host);
        if (scan.current) {
            scan.current.abort();
            scan.current = null;
            setDiscovery({ kind: 'idle' });
        }
        onConnect(host);
    }

    const canConnect = !connecting && Boolean(address.trim());
    return (
        <KeyboardAvoidingView style={ui.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
                <View style={styles.intro}>
                    <Text accessibilityRole="header" style={ui.heading}>Connect your phone</Text>
                    <Text style={ui.body}>Open Phone-Proctor on your exam computer and join the same network on both devices.</Text>
                </View>

                <View style={ui.section}>
                    <Text accessibilityRole="header" style={ui.sectionLabel}>Nearby computers</Text>
                    {discovery.kind === 'found' ? (
                        <>
                            <TouchableOpacity accessibilityRole="button" style={ui.item}
                                disabled={connecting} onPress={() => connect(discovery.server)}>
                                <View style={ui.icon}><Laptop color="white" size={17} /></View>
                                <View style={ui.grow}>
                                    <Text style={ui.label}>Exam computer</Text>
                                    <Text style={ui.body}>{discovery.server}</Text>
                                </View>
                                <ChevronRight color={palette.muted} size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" disabled={connecting} onPress={search} style={styles.textAction}>
                                <Text style={styles.textActionLabel}>Search again</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity accessibilityRole="button" style={ui.item}
                                accessibilityState={{ disabled: connecting || discovery.kind === 'searching', busy: discovery.kind === 'searching' }}
                                disabled={connecting || discovery.kind === 'searching'} onPress={search}>
                                <View style={ui.icon}><Radar color="white" size={17} /></View>
                                <View style={ui.grow}>
                                    <Text style={ui.label}>
                                        {discovery.kind === 'searching' ? 'Finding computers…' : discovery.kind === 'idle' ? 'Find a computer' : 'Search again'}
                                    </Text>
                                    <NetworkStatus style={ui.body} />
                                </View>
                                {discovery.kind === 'searching'
                                    ? <ActivityIndicator accessibilityLabel="Searching" color={palette.accent} />
                                    : <ChevronRight color={palette.muted} size={18} />}
                            </TouchableOpacity>
                            {discovery.kind === 'empty' && <Text accessibilityLiveRegion="polite" style={ui.body}>
                                No exam computer responded. Check your network or enter its address below.
                            </Text>}
                            {discovery.kind === 'error' && <Text accessibilityLiveRegion="polite" style={ui.error}>
                                Discovery failed. Try again or enter the address below.
                            </Text>}
                        </>
                    )}
                </View>

                <View style={ui.section}>
                    <Text accessibilityRole="header" style={ui.sectionLabel}>Manual connection</Text>
                    <View style={styles.inputRow}>
                        <Globe color={palette.muted} size={17} />
                        <TextInput accessibilityLabel="Computer address" autoCapitalize="none" autoCorrect={false}
                            returnKeyType="go" onSubmitEditing={() => connect(address)}
                            style={styles.input} value={address} onChangeText={value => { setAddress(value); setInvalid(false); }}
                            placeholder="Computer address" placeholderTextColor={palette.muted} editable={!connecting} />
                    </View>
                    {invalid ? <Text accessibilityLiveRegion="polite" style={ui.error}>Enter a valid IPv4 address or hostname.</Text>
                        : <Text style={ui.body}>Use the address shown on the exam computer.</Text>}
                    {connection.kind === 'error' && <Text accessibilityLiveRegion="polite" style={ui.error}>{connection.message}</Text>}
                </View>
            </ScrollView>
            <View style={ui.actionBar}>
                <View style={ui.actionGroup}>
                    <TouchableOpacity accessibilityRole="button"
                        accessibilityState={{ disabled: !canConnect, busy: connecting }} disabled={!canConnect}
                        style={[ui.button, !canConnect && ui.disabled]} onPress={() => connect(address)}>
                        <Text style={[ui.buttonText, !canConnect && ui.disabledText]}>
                            {connecting ? `Connecting to ${connection.address}…` : 'Connect'}
                        </Text>
                    </TouchableOpacity>
                    {connecting && <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={ui.secondary}>
                        <Text style={ui.secondaryText}>Cancel connection</Text>
                    </TouchableOpacity>}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    intro: { gap: 7 },
    inputRow: { minHeight: 48, borderColor: palette.line, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, alignItems: 'center', flexDirection: 'row', gap: 10 },
    input: { flex: 1, minHeight: 46, color: palette.ink, fontSize: 16, paddingVertical: 8 },
    textAction: { minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
    textActionLabel: { color: palette.accent, fontSize: 15, fontWeight: '600' },
});
