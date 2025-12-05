#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolValue;
use passport_verifier_lib::*;
// Import U256 for Solidity compatibility
use alloy_sol_types::private::U256;

pub fn main() {
    // Read the verification mode
    // We only have one mode now, but keeping the read for future extensibility or consistency
    let _mode = sp1_zkvm::io::read::<ProofType>();

    verify_passport_full();
}

fn verify_passport_full() {
    // Read inputs
    let passport = sp1_zkvm::io::read::<PassportAttributes>();
    let wallet_address = sp1_zkvm::io::read::<[u8; 20]>();
    let current_timestamp = sp1_zkvm::io::read::<u64>();
    let min_age = sp1_zkvm::io::read::<u16>();
    let target_nationality = sp1_zkvm::io::read::<String>();

    // 1. Verify Passport Signature
    // In a real implementation, this would verify the RSA/ECDSA signature of the passport data
    let is_valid_signature = verify_passport_signature(&passport);
    
    // 2. Verify Age
    let current_date = timestamp_to_date(current_timestamp);
    let age = calculate_age(&passport.date_of_birth, &current_date);
    let is_over_min_age = age >= min_age;

    // 3. Verify Nationality
    let is_nationality_match = passport.nationality == target_nationality;

    // 4. Create Identity Commitment
    let identity_commitment = derive_identity_commitment(&passport);

    // Prepare and commit public output
    let output = PassportVerificationOutput {
        is_valid_signature,
        is_over_min_age,
        is_nationality_match,
        identity_commitment: identity_commitment.into(),
        wallet_address: wallet_address.into(),
        min_age: U256::from(min_age),
        target_nationality,
        current_timestamp: U256::from(current_timestamp),
    };

    let bytes = PassportVerificationOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}
