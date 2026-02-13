# Phone Proctor Mobile App - Clean React Native Migration

This project has been **fully migrated from Expo to clean React Native** without any Expo dependencies.

## 🔄 Migration Summary

### Removed Dependencies
- ❌ `expo` and all `expo-*` packages
- ❌ `react-native-vision-camera` (build issues with worklets)
- ❌ `react-native-worklets-core` (C++ linking issues)

### New Dependencies (Pure React Native)
- ✅ `react-native-camera-kit` - Camera functionality
- ✅ `@react-native-community/netinfo` - Network monitoring
- ✅ `react-native-sensors` - Accelerometer, gyroscope, magnetometer, barometer
- ✅ `react-native-keep-awake` - Keep screen awake
- ✅ `react-native-system-setting` - Brightness control
- ✅ `react-native-audio-record` - Audio monitoring
- ✅ `react-native-fs` - File system operations
- ✅ `react-native-device-info` - Device information

## 📦 Installation

### 1. Clean Previous Installation

```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Clean Android build
cd android
./gradlew clean
cd ..
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Link Native Modules (if needed)

For React Native 0.74.5, most libraries auto-link. However, you may need to rebuild:

```bash
# Android
cd android
./gradlew clean
cd ..
```

### 4. Update Android Build

The `android/app/src/main/AndroidManifest.xml` has been updated with all necessary permissions:
- Camera
- Microphone
- Network access
- Sensors
- Brightness control
- File system access

## 🚀 Running the App

### Start Metro Bundler

```bash
npm start
```

### Run on Android

```bash
npm run android
```

### Run on iOS

```bash
cd ios
pod install
cd ..
npm run ios
```

## 🔧 Troubleshooting

### Camera Issues

If camera doesn't work:
1. Check `AndroidManifest.xml` has `<uses-permission android:name="android.permission.CAMERA"/>`
2. Request runtime permissions (already implemented in `CameraView.js`)

### Sensor Issues

If sensors don't work:
1. Make sure you're testing on a real device (sensors don't work in emulator)
2. Check that `react-native-sensors` is properly linked

### Build Errors

If you encounter build errors:

```bash
# Clean everything
cd android
./gradlew clean
./gradlew cleanBuildCache
cd ..
rm -rf node_modules
npm install
```

### Metro Bundler Cache Issues

```bash
npm start -- --reset-cache
```

## 📱 Features

- **Camera Streaming**: Captures and streams camera frames to server
- **Sensor Monitoring**: Accelerometer, gyroscope, magnetometer, barometer
- **Audio Monitoring**: Microphone level detection
- **Network Monitoring**: Detects network changes and connection type
- **Battery Saver**: Dims screen to minimum brightness during monitoring
- **Touch Detection**: Reports touch events as anomalies
- **Keep Awake**: Prevents screen from sleeping during proctoring

## 🏗️ Architecture

```
mobile-app/
├── src/
│   ├── components/
│   │   ├── CameraView.js      # Camera streaming (react-native-camera-kit)
│   │   └── NetworkStatus.js   # Network monitoring (@react-native-community/netinfo)
│   ├── services/
│   │   ├── socket.js           # WebSocket communication
│   │   └── LockdownService.js  # Sensor monitoring (react-native-sensors)
│   └── screens/
│       └── ConnectScreen.js    # Server connection UI
├── android/                    # Android native code
├── App.js                      # Main app component
├── index.js                    # Entry point
├── metro.config.js             # Metro bundler config
├── babel.config.js             # Babel transpiler config
└── package.json                # Dependencies
```

## 🔐 Permissions

The app requires the following permissions (all declared in `AndroidManifest.xml`):

- **CAMERA**: For video streaming
- **RECORD_AUDIO**: For audio monitoring
- **INTERNET**: For server communication
- **ACCESS_NETWORK_STATE**: For network monitoring
- **ACCESS_WIFI_STATE**: For WiFi detection
- **WRITE_SETTINGS**: For brightness control
- **WAKE_LOCK**: For keeping screen awake

## 📝 Key Changes

### CameraView.js
- Migrated from `react-native-vision-camera` to `react-native-camera-kit`
- Removed worklets dependency
- Simplified capture loop
- Added proper permission handling

### NetworkStatus.js
- Migrated from `expo-network` to `@react-native-community/netinfo`
- Real-time network state monitoring

### LockdownService.js
- Migrated from `expo-sensors` to `react-native-sensors`
- Migrated from `expo-av` to `react-native-audio-record`
- All sensor subscriptions use RxJS observables

### App.js
- Removed `expo-status-bar` and `expo-keep-awake`
- Using native `StatusBar` and `react-native-keep-awake`

## 🎯 Next Steps

1. **Test on real device** - Sensors and camera don't work well in emulators
2. **Configure server IP** - Update the connection screen with your server address
3. **Test all features** - Camera, sensors, audio, network monitoring
4. **Build release APK** - `cd android && ./gradlew assembleRelease`

## 📚 Documentation

- [React Native Camera Kit](https://github.com/teslamotors/react-native-camera-kit)
- [React Native Sensors](https://github.com/react-native-sensors/react-native-sensors)
- [NetInfo](https://github.com/react-native-netinfo/react-native-netinfo)
- [React Native FS](https://github.com/itinance/react-native-fs)

## ⚠️ Important Notes

- **No Expo**: This is now a pure React Native app. Do not run `expo start` or `expo run:android`
- **Use `react-native` CLI**: Use `npm start` and `npm run android` instead
- **Real Device Testing**: Most sensors require a physical device
- **Android 13+**: May require additional runtime permission requests

---

**Migration completed successfully! 🎉**
