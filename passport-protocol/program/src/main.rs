#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolValue;
use passport_verifier_lib::*;
// Import U256 for Solidity compatibility
use alloy_sol_types::private::U256;

pub fn main() {
    // Read the verification mode
    let mode = sp1_zkvm::io::read::<ProofType>();

    match mode {
        ProofType::AgeCheck => verify_age(),
        ProofType::NationalityCheck => verify_nationality(),
        ProofType::WalletLink => verify_wallet_binding(),
    }
}

fn verify_age() {
    // Read inputs
    let passport = sp1_zkvm::io::read::<PassportAttributes>();
    let current_timestamp = sp1_zkvm::io::read::<u64>();
    let min_age = sp1_zkvm::io::read::<u16>();

    // Verify signature
    if !verify_passport_signature(&passport) {
        panic!("Invalid passport signature");
    }

    // Calculate age
    let current_date = timestamp_to_date(current_timestamp);
    let age = calculate_age(&passport.date_of_birth, &current_date);
    let is_over_min_age = age >= min_age;

    // Create identity commitment
    let identity_commitment = derive_identity_commitment(&passport);

    // Prepare and commit public output
    let output = AgeCheckOutput {
        is_over_min_age,
        identity_commitment: identity_commitment.into(),
        min_age: U256::from(min_age),
        current_timestamp: U256::from(current_timestamp),
    };

    let bytes = AgeCheckOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}

fn verify_nationality() {
    // Read inputs
    let passport = sp1_zkvm::io::read::<PassportAttributes>();
    let target_nationality = sp1_zkvm::io::read::<String>();

    // Verify signature
    if !verify_passport_signature(&passport) {
        panic!("Invalid passport signature");
    }

    // Perform verification
    let is_match = passport.nationality == target_nationality;

    // Create identity commitment
    let identity_commitment = derive_identity_commitment(&passport);

    // Prepare and commit public output
    let output = NationalityCheckOutput {
        is_match,
        identity_commitment: identity_commitment.into(),
        target_nationality,
    };

    let bytes = NationalityCheckOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}

fn verify_wallet_binding() {
    // Read inputs
    let passport = sp1_zkvm::io::read::<PassportAttributes>();
    let wallet_address = sp1_zkvm::io::read::<[u8; 20]>();

    // Verify signature
    if !verify_passport_signature(&passport) {
        panic!("Invalid passport signature");
    }

    // Create identity commitment
    let identity_commitment = derive_identity_commitment(&passport);

    // Prepare and commit public output
    let output = WalletLinkOutput {
        identity_commitment: identity_commitment.into(),
        wallet_address: wallet_address.into(),
    };

    let bytes = WalletLinkOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}
