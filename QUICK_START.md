# Quick Start Guide - Clean React Native Setup

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Android Studio with SDK installed
- JDK 11 or higher
- Physical Android device (for sensor testing)

### Step 1: Install Dependencies

The installation is currently running. Once complete, you should see:

```bash
npm install
```

### Step 2: Clean Android Build

```bash
cd android
gradlew clean
cd ..
```

### Step 3: Start Metro Bundler

```bash
npm start
```

Keep this terminal open!

### Step 4: Run on Android (in a new terminal)

```bash
npm run android
```

## 📱 Testing Checklist

Once the app is running, verify:

- [ ] App launches successfully
- [ ] Camera permission requested
- [ ] Camera preview shows (dimmed with overlay)
- [ ] Can connect to server
- [ ] Network status displays correctly
- [ ] Sensors are monitoring (check device console logs)
- [ ] Screen stays awake
- [ ] Brightness dims when monitoring starts

## 🔧 Common Issues & Solutions

### Issue: "npm install" fails
**Solution:**
```bash
# Use cmd instead of PowerShell
cmd /c npm install
```

### Issue: Build fails with "Execution failed for task ':app:mergeDebugResources'"
**Solution:**
```bash
cd android
gradlew clean
gradlew assembleDebug
```

### Issue: Camera doesn't show
**Solution:**
1. Check permissions in Settings → Apps → Your App → Permissions
2. Make sure you're testing on a real device
3. Check `AndroidManifest.xml` has CAMERA permission

### Issue: Sensors not working
**Solution:**
- Sensors ONLY work on real devices, not emulators
- Check Android logs: `adb logcat | grep -i sensor`

### Issue: "Metro bundler can't find module"
**Solution:**
```bash
npm start -- --reset-cache
```

### Issue: Red screen errors about missing modules
**Solution:**
```bash
# Reinstall everything
rm -rf node_modules package-lock.json
npm install
cd android && gradlew clean && cd ..
npm start -- --reset-cache
```

## 🎯 Development Workflow

1. **Make code changes** in your editor
2. **Save the file** - Metro will auto-reload
3. **Shake device** to open dev menu if needed
4. **Enable Fast Refresh** in dev menu for instant updates

## 📊 Useful Commands

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Clean Metro cache
npm start -- --reset-cache

# View Android logs
adb logcat

# View React Native logs only
adb logcat | grep -i ReactNative

# Clean Android build
cd android && gradlew clean && cd ..

# Build release APK
cd android && gradlew assembleRelease && cd ..
```

## 🐛 Debugging

### Enable Debug Mode
1. Shake device
2. Select "Debug"
3. Open Chrome DevTools at `chrome://inspect`

### View Logs
```bash
# All logs
adb logcat

# React Native only
adb logcat | grep -i ReactNative

# Errors only
adb logcat *:E
```

## 📦 Build Release APK

```bash
cd android
gradlew assembleRelease
cd ..
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## 🔐 Signing (for Production)

1. Generate keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=*****
MYAPP_RELEASE_KEY_PASSWORD=*****
```

3. Build signed APK:
```bash
cd android && gradlew assembleRelease
```

---

**Happy Coding! 🎉**

For detailed migration info, see `MIGRATION_SUMMARY.md`
For troubleshooting, see `README.md`
