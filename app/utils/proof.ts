// publicValues ABI layout (after stripping the leading 32-byte offset):
//   bytes32 identityHash  → chars 0–63
//   address walletAddress → chars 64–127  (last 40 are the address)
//   address verifierAddr  → chars 128–191 (last 40 are the address)
export function extractVerifierAddress(publicValues: string): string {
  const hex = publicValues.replace(/^0x/, '');
  return '0x' + hex.slice(64 + 64 + 64 + 24, 64 + 64 + 64 + 64);
}
