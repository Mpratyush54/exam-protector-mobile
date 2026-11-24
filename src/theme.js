import { StyleSheet } from 'react-native';

export const palette = {
    page: '#ffffff',
    ink: '#17191c',
    muted: '#62666d',
    line: '#ebedf0',
    accent: '#2462db',
    good: '#187250',
    danger: '#a52a3a',
};

export const ui = StyleSheet.create({
    page: { flex: 1, backgroundColor: palette.page },
    content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28, gap: 32 },
    mark: { width: 33, height: 33, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21252b' },
    brandText: { color: palette.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
    heading: { color: palette.ink, fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
    body: { color: palette.muted, fontSize: 15, lineHeight: 22 },
    label: { color: palette.ink, fontSize: 16, fontWeight: '600' },
    sectionLabel: { color: palette.muted, fontSize: 14, fontWeight: '600' },
    section: { gap: 10 },
    icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    grow: { flex: 1 },
    actionBar: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.line, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
    actionGroup: { width: '100%', maxWidth: 512, gap: 8 },
    button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14, backgroundColor: palette.accent },
    buttonText: { color: 'white', fontWeight: '600', fontSize: 15, textAlign: 'center' },
    secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.line },
    secondaryText: { color: palette.ink, fontWeight: '600', fontSize: 14 },
    disabled: { backgroundColor: '#e8effc' },
    disabledText: { color: '#506283' },
    error: { color: palette.danger, fontSize: 14, lineHeight: 21 },
});

export function validAddress(address) {
    if (/^[0-9.]+$/.test(address)) {
        const parts = address.split('.');
        return parts.length === 4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
    }
    return address.length <= 253 && address.split('.').every(label =>
        /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}
