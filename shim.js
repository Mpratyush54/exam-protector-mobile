// Shim for react-native-udp
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer;

// Needed for dgram
global.process = require('process');
