import { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAddressScanned: (address: string) => void;
}

export default function QRScanModal({ visible, onClose, onAddressScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!visible) return;
    if (permission?.granted) return;
    requestPermission().then(({ granted }) => {
      if (!granted) {
        Alert.alert('Camera permission required', 'Please allow camera access to scan QR codes.');
        onClose();
      }
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBarcodeScan = ({ data }: { data: string }) => {
    const address = data.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
      onAddressScanned(address);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScan}
        />

        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.boxWrapper}>
            <Text style={styles.hint}>scan app contract qr</Text>
            <View style={styles.cutout} />
          </View>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const CUTOUT = 250;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cutout: {
    width: CUTOUT,
    height: CUTOUT,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    // punch a transparent hole through the dim overlay
    shadowColor: 'transparent',
  },
  boxWrapper: {
    alignItems: 'center',
  },
  hint: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 20,
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
});
