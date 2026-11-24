import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

class FakeSocket {
    static OPEN = 1;
    readyState = 1;
    sent = [];

    close() {
        this.readyState = 3;
    }

    send(data) {
        this.sent.push(data);
    }
}

async function loadService(file, globals = {}, imports = {}) {
    const url = new URL(`../src/services/${file}.js`, import.meta.url);
    const context = vm.createContext({
        WebSocket: FakeSocket, setTimeout, clearTimeout, setInterval, clearInterval, ...globals,
    });
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context });
    await module.link(specifier => new vm.SyntheticModule(Object.keys(imports[specifier]), function () {
        for (const [name, value] of Object.entries(imports[specifier])) this.setExport(name, value);
    }, { context }));
    await module.evaluate();
    return module.namespace;
}

test('replacement and disconnect detach the old phone socket', async () => {
    const { connectSocket, disconnectSocket, sendTcpMessage } = await loadService('socket');
    const first = connectSocket('192.168.1.2');
    first.onclose = () => assert.fail('Superseded socket acted on current connection');
    const second = connectSocket('192.168.1.3');

    assert.equal(first.readyState, 3);
    assert.equal(first.onclose, null);
    assert.equal(sendTcpMessage('TELEMETRY', { acc: null }), true);
    assert.deepEqual(JSON.parse(second.sent[0]), { type: 'TELEMETRY', data: { acc: null } });
    disconnectSocket();
    assert.equal(sendTcpMessage('TELEMETRY', {}), false);
});

test('capture finishing after disconnect deletes its temporary file without sending it', async () => {
    const socket = new FakeSocket();
    let scheduledCapture;
    let settleCapture;
    const pending = new Promise(resolve => { settleCapture = resolve; });
    const removed = [];
    const { default: frames } = await loadService('WSFrameService', {
        setTimeout: callback => { scheduledCapture = callback; },
        clearTimeout() {},
    }, {
        'react-native-fs': { default: {
            readFile: async () => assert.fail('Disconnected capture still read the image'),
            unlink: async path => removed.push(path),
        } },
    });

    frames.start(socket, () => pending, () => 'front', () => assert.fail('Disconnected capture reported status'));
    const running = scheduledCapture();
    frames.stop();
    settleCapture({ uri: 'file:///camera.jpg' });
    await running;

    assert.deepEqual(removed, ['/camera.jpg']);
    assert.equal(socket.sent.length, 0);
});

test('discovery releases its UDP socket on cancellation and a valid reply', async () => {
    class FakeUdp extends EventEmitter {
        bind() {}
        close() { this.closed = true; }
    }
    let socket;
    const { discoverServer } = await loadService('discovery', {}, {
        'react-native-udp': { default: { createSocket: () => (socket = new FakeUdp()) } },
        buffer: { Buffer },
    });

    const controller = new AbortController();
    const cancelled = discoverServer(controller.signal);
    controller.abort();
    assert.equal(await cancelled, null);
    assert.equal(socket.closed, true);

    const search = discoverServer();
    socket.emit('message', Buffer.from('PROCTOR_HERE'), { address: '192.168.1.4' });
    assert.equal(await search, '192.168.1.4');
    assert.equal(socket.closed, true);
});

test('microphone permission resolving after disconnect releases the stream', async () => {
    let resolveMic;
    let tracksStopped = 0;
    let streamsReleased = 0;
    const pendingMic = new Promise(resolve => { resolveMic = resolve; });
    const { default: service } = await loadService('WebRTCService', {}, {
        'react-native-webrtc': {
            mediaDevices: { getUserMedia: () => pendingMic },
            RTCPeerConnection: () => assert.fail('A cancelled stream created a peer'),
            RTCSessionDescription: null,
        },
    });

    const starting = service.start(new FakeSocket(), () => assert.fail('Stale microphone reported status'));
    service.stop();
    resolveMic({
        getTracks: () => [{ stop: () => { tracksStopped++; } }],
        release: () => { streamsReleased++; },
    });
    await starting;

    assert.equal(tracksStopped, 1);
    assert.equal(streamsReleased, 1);
});

test('large frames use a longer capture interval to limit bandwidth', async () => {
    const socket = new FakeSocket();
    let scheduled;
    let nextDelay;
    const { default: frames } = await loadService('WSFrameService', {
        setTimeout: (callback, delay) => {
            scheduled = callback;
            nextDelay = delay;
        },
        clearTimeout() {},
    }, {
        'react-native-fs': { default: {
            readFile: async () => 'a'.repeat(1024 * 1024),
            unlink: async () => {},
        } },
    });
    let status;
    frames.start(socket, async () => ({ uri: 'file:///camera.jpg' }), () => 'back', value => { status = value; });
    await scheduled();

    assert.equal(JSON.parse(socket.sent[0]).data.camera, 'back');
    assert.equal(status, 'Sending frames');
    assert.ok(nextDelay >= 2000);
    frames.stop();
});
