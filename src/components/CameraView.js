import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';

const CameraStream = forwardRef(({ cameraType }, ref) => (
    <View style={styles.container}>
        <Camera ref={ref} style={StyleSheet.absoluteFill}
            cameraType={cameraType === 'front' ? CameraType.Front : CameraType.Back}
            flashMode="off" shutterAnimationDuration={0} />
    </View>
));

export default CameraStream;

const styles = StyleSheet.create({
    container: { aspectRatio: 4 / 3, maxHeight: 360, backgroundColor: '#202c37', overflow: 'hidden', borderRadius: 14 },
});
