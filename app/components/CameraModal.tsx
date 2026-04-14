import { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Standard passport page (ICAO 9303 ID-3): 125mm × 88mm, landscape
const PASSPORT_ASPECT = 125 / 88;
const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL ?? '';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPassportScanned: (data: Record<string, any>) => void;
}

export default function CameraModal({ visible, onClose, onPassportScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [ocrLoading, setOcrLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const overlayWidth = cameraLayout.width * 0.85;
  const overlayHeight = overlayWidth / PASSPORT_ASPECT;

  useEffect(() => {
    if (!visible) return;
    if (permission?.granted) return;
    requestPermission().then(({ granted }) => {
      if (!granted) {
        Alert.alert('Camera permission required', 'Please allow camera access to scan your passport.');
        onClose();
      }
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setCapturedImage(null);
    setOcrLoading(false);
    onClose();
  };

  const handleCapture = async () => {
    if (!cameraRef.current || cameraLayout.width === 0) return;

    const photo = await cameraRef.current.takePictureAsync({ skipProcessing: false });
    if (!photo) return;

    // Map overlay screen coordinates → photo pixel coordinates.
    // CameraView uses "cover" scaling — the sensor image is scaled to fill the
    // view, so the full photo has more content than what's visible on screen.
    const previewAspect = cameraLayout.width / cameraLayout.height;
    const photoAspect = photo.width / photo.height;

    let scaleFactor: number;
    let photoOffsetX: number;
    let photoOffsetY: number;

    if (photoAspect > previewAspect) {
      // Photo wider than preview → height fills exactly, left/right edges cropped
      scaleFactor = photo.height / cameraLayout.height;
      photoOffsetX = (photo.width - cameraLayout.width * scaleFactor) / 2;
      photoOffsetY = 0;
    } else {
      // Photo taller than preview → width fills exactly, top/bottom edges cropped
      scaleFactor = photo.width / cameraLayout.width;
      photoOffsetX = 0;
      photoOffsetY = (photo.height - cameraLayout.height * scaleFactor) / 2;
    }

    const overlayX = (cameraLayout.width - overlayWidth) / 2;
    const overlayY = (cameraLayout.height - overlayHeight) / 2;

    const cropX = Math.max(0, Math.round(photoOffsetX + overlayX * scaleFactor));
    const cropY = Math.max(0, Math.round(photoOffsetY + overlayY * scaleFactor));
    const cropW = Math.min(Math.round(overlayWidth * scaleFactor), photo.width - cropX);
    const cropH = Math.min(Math.round(overlayHeight * scaleFactor), photo.height - cropY);

    const cropped = await manipulateAsync(
      photo.uri,
      [
        { crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } },
        { resize: { width: 800 } },
      ],
      { format: SaveFormat.JPEG, compress: 0.6 },
    );

    setCapturedImage(cropped.uri);
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri: capturedImage, type: 'image/jpeg', name: 'passport.jpg' } as any);
      const response = await fetch(`${OCR_API_URL}/ocr/passport`, { method: 'POST', body: formData });
      const text = await response.text();
      if (!text) {
        Alert.alert('OCR failed', 'Server returned an empty response. Check the OCR server logs.');
        return;
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        Alert.alert('OCR failed', `Invalid server response:\n${text.slice(0, 200)}`);
        return;
      }
      if (!json.success) {
        Alert.alert('OCR failed', json.error ?? 'Unknown error');
        return;
      }
      if (!json.data) {
        Alert.alert('No passport found', 'Could not detect passport data. Please retake the photo.');
        return;
      }
      onPassportScanned(json.data);
      handleClose();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to contact OCR service.');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      {capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
          <View style={styles.previewButtons}>
            <TouchableOpacity
              style={[styles.previewButton, ocrLoading && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={handleConfirm}
              disabled={ocrLoading}
            >
              <Text style={styles.previewButtonText}>{ocrLoading ? 'reading...' : 'confirm'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewButton}
              activeOpacity={0.7}
              onPress={() => setCapturedImage(null)}
            >
              <Text style={styles.previewButtonText}>cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={styles.cameraContainer}
          onLayout={(e) => setCameraLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />

          {/* Semi-transparent overlay with passport cutout */}
          {cameraLayout.width > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              <View style={{ flexDirection: 'row', height: overlayHeight }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                <View style={{ width: overlayWidth, borderWidth: 2, borderColor: '#ffffff' }} />
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
            </View>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>scan your passport</Text>

          <TouchableOpacity style={styles.captureButton} activeOpacity={0.8} onPress={handleCapture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
  },
  hint: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 1,
  },
  captureButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    aspectRatio: PASSPORT_ASPECT,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  previewButtons: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 16,
  },
  previewButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  previewButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
