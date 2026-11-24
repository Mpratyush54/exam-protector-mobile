import { RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';

class WebRTCService {
    async start(socket, onState) {
        this.stop();
        this.socket = socket;
        const send = (type, data) => {
            if (this.socket === socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type, data }));
            }
        };

        try {
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            if (this.socket !== socket) {
                stream.getTracks().forEach(track => track.stop());
                stream.release();
                return;
            }
            this.localStream = stream;
            const pc = new RTCPeerConnection({ iceServers: [] });
            this.pc = pc;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const pendingCandidates = [];
            let offerSent = false;
            pc.onicecandidate = ({ candidate }) => {
                if (!candidate) return;
                if (offerSent) send('WEBRTC_CANDIDATE', candidate.toJSON());
                else pendingCandidates.push(candidate.toJSON());
            };
            pc.oniceconnectionstatechange = () => {
                if (this.pc !== pc) return;
                if (['connected', 'completed'].includes(pc.iceConnectionState)) onState('Streaming audio');
                else if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) onState('Audio unavailable');
            };

            const offer = await pc.createOffer();
            if (this.pc !== pc) return;
            await pc.setLocalDescription(offer);
            if (this.pc === pc) {
                send('WEBRTC_OFFER', { sdp: pc.localDescription.sdp, type: pc.localDescription.type });
                offerSent = true;
                for (const candidate of pendingCandidates) send('WEBRTC_CANDIDATE', candidate);
                pendingCandidates.length = 0;
            }
        } catch {
            if (this.socket === socket) onState('Audio unavailable');
        }
    }

    async handleAnswer(answer) {
        const pc = this.pc;
        if (!pc || !answer) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    stop() {
        const pc = this.pc;
        const stream = this.localStream;
        this.socket = this.pc = this.localStream = null;
        if (pc) {
            pc.onicecandidate = pc.oniceconnectionstatechange = null;
            pc.close();
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream.release();
        }
    }
}

export default new WebRTCService();
