import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  passportData: Record<string, any> | null;
  onClose: () => void;
  onGenerateProof: () => void;
  proofLoading: boolean;
}

export default function PassportModal({ visible, passportData, onClose, onGenerateProof, proofLoading }: Props) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>passport data</Text>
        {passportData && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {[
                ['document no.',    passportData.documentNumber],
                ['name',            passportData.name],
                ['nationality',     passportData.nationality],
                ['date of birth',   passportData.dateOfBirth],
                ['sex',             passportData.sex],
                ['identity no.',    passportData.personalNumber],
                ['date of expiry',  passportData.dateOfExpiry],
                ['issuing country', passportData.issuingCountry],
              ].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, value]) => (
                <View key={label as string} style={styles.row}>
                  <Text style={styles.label}>{label as string}</Text>
                  <Text style={styles.value}>{String(value)}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.generateButton, proofLoading && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={onGenerateProof}
              disabled={proofLoading}
            >
              <Text style={styles.generateButtonText}>{proofLoading ? 'generating...' : 'generate proof'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060010',
    paddingTop: 100,
    paddingHorizontal: 24,
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
  title: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 32,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: -1,
  },
  label: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 15,
    color: '#ffffff',
    width: 150,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  value: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 15,
    color: '#ffffff',
    flex: 1,
    padding: 12,
  },
  generateButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 48,
  },
  generateButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
