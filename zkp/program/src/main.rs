#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolValue;
use passport_verifier_lib::*;

// Verification mode
#[derive(serde::Deserialize, serde::Serialize)]
pub enum VerificationMode {
    Age,
    Nationality,
    WalletBinding,
}

pub fn main() {
    // Read the verification mode
    let mode = sp1_zkvm::io::read::<VerificationMode>();

    match mode {
        VerificationMode::Age => verify_age(),
        VerificationMode::Nationality => verify_nationality(),
        VerificationMode::WalletBinding => verify_wallet_binding(),
    }
}

fn verify_age() {
    // Read private inputs
    let passport = sp1_zkvm::io::read::<PassportData>();
    let current_date = sp1_zkvm::io::read::<Date>();
    let min_age = sp1_zkvm::io::read::<u16>();

    // Calculate age (private computation)
    let age = calculate_age(&passport.date_of_birth, &current_date);
    let is_over_min_age = age >= min_age;

    // Create passport commitment
    let passport_commitment = create_passport_commitment(&passport);

    // Prepare and commit public output
    let output = AgeVerificationOutput {
        is_over_18: is_over_min_age,
        passport_commitment: passport_commitment.into(),
    };

    let bytes = AgeVerificationOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}

fn verify_nationality() {
    // Read private inputs
    let passport = sp1_zkvm::io::read::<PassportData>();
    let target_nationality = sp1_zkvm::io::read::<String>();

    // Perform verification (private computation)
    let is_match = passport.nationality == target_nationality;

    // Create passport commitment
    let passport_commitment = create_passport_commitment(&passport);

    // Prepare and commit public output
    let output = NationalityVerificationOutput {
        is_target_nationality: is_match,
        passport_commitment: passport_commitment.into(),
    };

    let bytes = NationalityVerificationOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}

fn verify_wallet_binding() {
    // Read private inputs
    let passport = sp1_zkvm::io::read::<PassportData>();
    let wallet_address = sp1_zkvm::io::read::<[u8; 20]>();

    // Create deterministic binding commitment
    let binding_commitment = create_wallet_binding(&passport, &wallet_address);

    // Prepare and commit public output
    let output = WalletBindingOutput {
        binding_commitment: binding_commitment.into(),
        wallet_address: wallet_address.into(),
    };

    let bytes = WalletBindingOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}
