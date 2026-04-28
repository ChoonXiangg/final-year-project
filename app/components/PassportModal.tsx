import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface ProofResult {
  proof: string;
  publicValues: string;
  vkey: string;
}

interface Props {
  visible: boolean;
  passportData: Record<string, any> | null;
  proofResult: ProofResult | null;
  onClose: () => void;
  onGenerateProof: () => void;
  proofLoading: boolean;
  onSubmit: () => void;
  submitting: boolean;
  onClearProof: () => void;
}

export default function PassportModal({ visible, passportData, proofResult, onClose, onGenerateProof, proofLoading, onSubmit, submitting, onClearProof }: Props) {
  const showProof = proofResult !== null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{showProof ? 'proof' : 'passport data'}</Text>

        {showProof ? (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {([
                ['proof',         proofResult.proof],
                ['public values', proofResult.publicValues],
                ['vkey',          proofResult.vkey],
              ] as [string, string][]).map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  {label === 'public values' ? (
                    <Text style={styles.value}>{value}</Text>
                  ) : (
                    <Text style={styles.value} numberOfLines={4} ellipsizeMode="middle">{value}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.actionButton, submitting && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.actionButtonText}>{submitting ? 'submitting...' : 'submit on-chain'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discardButton}
              activeOpacity={0.7}
              onPress={onClearProof}
              disabled={submitting}
            >
              <Text style={styles.discardButtonText}>discard proof</Text>
            </TouchableOpacity>
          </>
        ) : passportData ? (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {([
                ['document no.',    passportData.documentNumber],
                ['name',            passportData.name],
                ['nationality',     passportData.nationality],
                ['date of birth',   passportData.dateOfBirth],
                ['sex',             passportData.sex],
                ['identity no.',    passportData.personalNumber],
                ['date of expiry',  passportData.dateOfExpiry],
                ['issuing country', passportData.issuingCountry],
              ] as [string, any][]).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{String(value)}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.actionButton, proofLoading && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={onGenerateProof}
              disabled={proofLoading}
            >
              <Text style={styles.actionButtonText}>{proofLoading ? 'generating...' : 'generate proof'}</Text>
            </TouchableOpacity>
          </>
        ) : null}
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
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 20,
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
    fontSize: 12,
    color: '#ffffff',
    width: 150,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  value: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
    padding: 12,
  },
  actionButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 48,
  },
  actionButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  discardButton: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  discardButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 10,
    color: '#555',
  },
});
