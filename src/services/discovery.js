import UdpSocket from 'react-native-udp';
import { Buffer } from 'buffer';

const PORT = 5001;
const PROBE = Buffer.from('PROCTOR_DISCOVER');
const TARGETS = [
    '255.255.255.255', '192.168.1.255', '192.168.0.255', '10.0.0.255',
    '192.168.43.255', '172.20.10.15', '192.168.137.255',
];

export function discoverServer(signal) {
    return new Promise((resolve, reject) => {
        let socket;
        let timer;
        let retry;
        let finished = false;
        let deliveredProbe = false;

        const finish = (result, error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            clearInterval(retry);
            signal?.removeEventListener('abort', cancel);
            try { socket?.close(); } catch {}
            if (error) reject(error);
            else resolve(result);
        };
        const cancel = () => finish(null);
        const probe = () => {
            for (const host of TARGETS) {
                socket.send(PROBE, 0, PROBE.length, PORT, host, error => {
                    if (!error) deliveredProbe = true;
                });
            }
        };

        try {
            signal?.addEventListener('abort', cancel);
            if (signal?.aborted) {
                cancel();
                return;
            }
            socket = UdpSocket.createSocket('udp4');
            socket.on('error', error => finish(null, error));
            socket.on('message', (message, remote) => {
                if (['PROCTOR_HERE', 'PROCTOR_ANNOUNCE'].includes(message.toString())) {
                    finish(remote.address);
                }
            });
            socket.on('listening', () => {
                if (finished) return;
                try {
                    socket.setBroadcast(true);
                    retry = setInterval(() => {
                        try { probe(); } catch (error) { finish(null, error); }
                    }, 900);
                    probe();
                } catch (error) {
                    finish(null, error);
                }
            });
            timer = setTimeout(() => {
                finish(null, deliveredProbe ? undefined : new Error('Discovery could not send a local broadcast'));
            }, 4000);
            socket.bind(0, '0.0.0.0');
        } catch (error) {
            finish(null, error);
        }
    });
}
