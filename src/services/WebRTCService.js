import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
} from 'react-native-webrtc';

// No STUN - force LAN-only
const configuration = {
    iceServers: [],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 0
};

class WebRTCService {
    constructor() {
        this.pc = null;
        this.localStream = null;
        this.socket = null;
        this.connected = false;
    }

    async start(socket, isFront = false) {
        this.socket = socket;
        console.log('[WebRTC] Starting (audio only transport)...');

        // 1. Get Audio stream only (video is handled by CameraKit + WS now)
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: false, // Video handled by WSFrameService
            });

            this.localStream = stream;
            console.log('[WebRTC] Got Audio Stream');
        } catch (err) {
            console.error('[WebRTC] Failed to get audio', err);
            return;
        }

        // 2. Create Peer Connection
        this.pc = new RTCPeerConnection(configuration);

        // 3. Add Audio Track only
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.pc.addTrack(track, this.localStream);
            });
        }

        // 4. Handle ICE Candidates
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[WebRTC] ICE Candidate: ' + event.candidate.candidate);
                const msg = JSON.stringify({
                    type: 'WEBRTC_CANDIDATE',
                    data: event.candidate.toJSON()
                });
                this.socket?.send(msg);
            }
        };

        // 5. Monitor ICE state
        this.pc.oniceconnectionstatechange = () => {
            const state = this.pc?.iceConnectionState;
            console.log(`[WebRTC] ICE State: ${state}`);
            if (state === 'connected' || state === 'completed') {
                this.connected = true;
                console.log('[WebRTC] ✅ Audio connected via WebRTC');
            }
        };

        // 6. Create Offer
        try {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            console.log('[WebRTC] Sending Offer');
            this.sendSignalingMessage('WEBRTC_OFFER', {
                sdp: this.pc.localDescription.sdp,
                type: this.pc.localDescription.type,
            });
        } catch (err) {
            console.error('[WebRTC] Offer Error', err);
        }
    }

    sendSignalingMessage(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, data }));
        }
    }

    async handleAnswer(answer) {
        if (!this.pc) return;
        console.log('[WebRTC] Setting Remote Description (Answer)');
        try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.error('[WebRTC] Set Remote Desc Error', err);
        }
    }

    stop() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            try { this.localStream.release(); } catch (e) { }
        }
        if (this.pc) {
            this.pc.close();
        }
        this.pc = null;
        this.localStream = null;
        this.connected = false;
    }
}

export default new WebRTCService();
