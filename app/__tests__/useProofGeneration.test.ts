/**
 * @jest-environment node
 *
 * Unit tests for pure utility functions in useProofGeneration.
 * No network calls or native modules required.
 */
import { extractVerifierAddress } from '../utils/proof';

// publicValues from proofs/latest.json — real proof output
const SAMPLE_PUBLIC_VALUES =
  '000000000000000000000000000000000000000000000000000000000000002015ff13a9167422fc2ff9e6e80041ee094186326cdad1ad0e815e8e470cf51df20000000000000000000000000e6384b01aee17ed117054f658e49a11b26fc904000000000000000000000000ac9168fc5f90b64cb358949de3cebfa61da5739b';

describe('extractVerifierAddress', () => {
  it('extracts the correct verifier address from publicValues', () => {
    const addr = extractVerifierAddress(SAMPLE_PUBLIC_VALUES);
    expect(addr.toLowerCase()).toBe('0xac9168fc5f90b64cb358949de3cebfa61da5739b');
  });

  it('handles 0x prefix correctly', () => {
    const addr = extractVerifierAddress('0x' + SAMPLE_PUBLIC_VALUES);
    expect(addr.toLowerCase()).toBe('0xac9168fc5f90b64cb358949de3cebfa61da5739b');
  });

  it('returns address with 0x prefix', () => {
    const addr = extractVerifierAddress(SAMPLE_PUBLIC_VALUES);
    expect(addr.startsWith('0x')).toBe(true);
  });

  it('returned address is 42 characters long', () => {
    const addr = extractVerifierAddress(SAMPLE_PUBLIC_VALUES);
    expect(addr).toHaveLength(42);
  });
});
