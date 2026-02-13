import { StyleSheet, View, Text, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ConnectScreen from './src/screens/ConnectScreen';
import CameraStream from './src/components/CameraView';
import NetworkStatus from './src/components/NetworkStatus';
import { connectSocket, getSocket } from './src/services/socket';
import KeepAwake from 'react-native-keep-awake';
import { lockdownService } from './src/services/LockdownService';
import WebRTCService from './src/services/WebRTCService';
import WSFrameService from './src/services/WSFrameService';
import TelemetryService from './src/services/TelemetryService';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const cameraRef = useRef(null);
  const socketRef = useRef(null);

  // Lifecycle for sensors
  useEffect(() => {
    if (isConnected) {
      lockdownService.startMonitoring();
    } else {
      lockdownService.stopMonitoring();
    }
  }, [isConnected]);

  const startWSFrameCapture = (socket) => {
    // Small delay to let camera initialize
    setTimeout(() => {
      if (cameraRef.current) {
        const camRef = cameraRef.current.getCameraRef();
        console.log('[App] Starting WS Frame Capture...');
        WSFrameService.start(socket, camRef);
      } else {
        console.log('[App] Camera ref not ready, retrying in 2s...');
        setTimeout(() => {
          if (cameraRef.current) {
            const camRef = cameraRef.current.getCameraRef();
            WSFrameService.start(socket, camRef);
          }
        }, 2000);
      }
    }, 1000);
  };

  const handleConnect = (ip) => {
    setServerIp(ip);
    const socket = connectSocket(ip);
    socketRef.current = socket;

    // Listen for successful connection
    socket.on('connect', async () => {
      setIsConnected(true);

      // I. Start WebRTC for audio only (may fail, that's OK)
      try {
        await WebRTCService.start(socket);
      } catch (e) {
        console.error("WebRTC audio failed:", e);
      }

      // II. Start TCP Telemetry
      try {
        TelemetryService.connect(ip, 5001);
      } catch (e) {
        console.error("Telemetry failed:", e);
      }

      // III. Start WS Video Frames immediately (don't wait for WebRTC)
      console.log('[App] Starting WS Frame capture...');
      startWSFrameCapture(socket);
    });

    socket.on('close', () => {
      setIsConnected(false);
      WebRTCService.stop();
      WSFrameService.stop();
      TelemetryService.disconnect();
    });

    // Handle messages from Server
    socket.on('data', (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'WEBRTC_ANSWER') {
          console.log('[App] Received WEBRTC_ANSWER from server');
          WebRTCService.handleAnswer(parsed.data);
        } else if (parsed.type === 'START_WS_FRAMES') {
          // Server confirmed fallback mode
          console.log('[App] Server confirmed WS Frame mode');
          startWSFrameCapture(socket);
        }
      } catch (e) { }
    });
  };

  const handleTouch = () => {
    if (isConnected) {
      lockdownService.reportTouch({ nativeEvent: { locationX: 0, locationY: 0 } });
    }
  };

  return (
    <View style={styles.container} onTouchStart={handleTouch}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {isConnected && <KeepAwake />}

      {!isConnected ? (
        <ConnectScreen onConnect={handleConnect} />
      ) : (
        <SafeAreaView style={styles.mainContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Proctor Active</Text>
            <View style={styles.statusDot} />
          </View>

          <View style={styles.cameraContainer}>
            <CameraStream ref={cameraRef} isActive={isConnected} />
          </View>

          <View style={styles.infoPanel}>
            <NetworkStatus />
            <Text style={styles.serverInfo}>Connected to: {serverIp}</Text>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mainContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    backgroundColor: '#000000',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#444',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803d',
  },
  cameraContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#000',
  },
  infoPanel: {
    padding: 16,
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#111',
  },
  serverInfo: {
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 10,
  },
});
