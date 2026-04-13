import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface ProofResult {
  proof: string;
  publicValues: string;
  vkey: string;
}

interface Props {
  visible: boolean;
  proofResult: ProofResult | null;
  onClose: () => void;
}

export default function ProofModal({ visible, proofResult, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>proof</Text>
        {proofResult && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {[
              ['vkey',          proofResult.vkey],
              ['public values', proofResult.publicValues],
              ['proof',         proofResult.proof],
            ].map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value} numberOfLines={4} ellipsizeMode="middle">
                  {value}
                </Text>
              </View>
            ))}
          </ScrollView>
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
});
