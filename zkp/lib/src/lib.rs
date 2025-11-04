use alloy_sol_types::sol;
use serde::{Deserialize, Serialize};

// VERIFICATION MODE

// Verification mode for the passport verifier
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum VerificationMode {
    Age,
    Nationality,
    WalletBinding,
}

// DATA STRUCTURES

// Represents a date (year, month, day)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Date {
    pub year: u16,
    pub month: u8,
    pub day: u8,
}

// Passport data structure (Machine Readable Zone fields)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PassportData {
    pub document_number: String,
    pub date_of_birth: Date,
    pub date_of_expiry: Date,
    pub nationality: String,
    pub given_names: String,
    pub surname: String,
}

// SOLIDITY-COMPATIBLE OUTPUT STRUCTS

sol! {
    // Output for age verification proof
    struct AgeVerificationOutput {
        bool is_over_18;
        bytes32 passport_commitment;
    }
}

sol! {
    // Output for nationality verification proof
    struct NationalityVerificationOutput {
        bool is_target_nationality;
        bytes32 passport_commitment;
    }
}

sol! {
    // Output for wallet binding proof
    struct WalletBindingOutput {
        bytes32 binding_commitment;
        address wallet_address;
    }
}

// Calculate age in years given birthdate and current date
pub fn calculate_age(birth: &Date, current: &Date) -> u16 {
    let mut age = current.year - birth.year;
    
    // Adjust if birthday hasn't occurred yet this year
    if current.month < birth.month || (current.month == birth.month && current.day < birth.day) {
        age -= 1;
    }
    
    age
}

// Create a deterministic commitment from passport data
// This is used to link multiple proofs to the same passport without revealing identity
pub fn create_passport_commitment(passport: &PassportData) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(passport.document_number.as_bytes());
    hasher.update(&passport.date_of_birth.year.to_le_bytes());
    hasher.update(&[passport.date_of_birth.month]);
    hasher.update(&[passport.date_of_birth.day]);
    hasher.update(passport.nationality.as_bytes());
    
    let result = hasher.finalize();
    let mut commitment = [0u8; 32];
    commitment.copy_from_slice(&result);
    commitment
}

// Create wallet binding commitment
pub fn create_wallet_binding(passport: &PassportData, wallet_address: &[u8; 20]) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    
    let passport_commitment = create_passport_commitment(passport);
    
    let mut hasher = Sha256::new();
    hasher.update(&passport_commitment);
    hasher.update(wallet_address);
    
    let result = hasher.finalize();
    let mut binding = [0u8; 32];
    binding.copy_from_slice(&result);
    binding
}