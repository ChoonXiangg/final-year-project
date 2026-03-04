use alloy_sol_types::sol;
use serde::{Deserialize, Serialize};

// PROOF TYPE

// Type of proof to generate
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ProofType {
    ProofOfPassport,
}

// DATA STRUCTURES

// Represents a date (year, month, day)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Date {
    pub year: u16,
    pub month: u8,
    pub day: u8,
}

// Passport attributes (Machine Readable Zone fields)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PassportAttributes {
    pub document_number: String,
    pub date_of_birth: Date,
    pub date_of_expiry: Date,
    pub nationality: String,
    pub given_names: String,
    pub surname: String,
    // Signature fields for verification
    pub signature: Vec<u8>, // RSA/ECDSA signature of the SOD/DG15
    pub signed_attributes: Vec<u8>, // The data that was signed
}

// SOLIDITY-COMPATIBLE OUTPUT STRUCTS

sol! {
    // Output for the combined passport verification proof
    struct PassportVerificationOutput {
        bool is_valid_signature;
        bool is_over_min_age;
        bool is_nationality_match;
        bytes32 identity_commitment;
        address wallet_address;
        uint256 min_age;
        string target_nationality;
        uint256 current_timestamp;
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

// Create a deterministic commitment from passport attributes
// This is used to link multiple proofs to the same identity without revealing it
pub fn derive_identity_commitment(passport: &PassportAttributes) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(passport.document_number.as_bytes());
    hasher.update(&passport.date_of_birth.year.to_le_bytes());
    hasher.update(&[passport.date_of_birth.month]);
    hasher.update(&[passport.date_of_birth.day]);
    hasher.update(passport.nationality.as_bytes());
    // We do NOT include the signature in the commitment because we want it to be deterministic
    // based on the identity data, not the specific cryptographic proof.
    
    let result = hasher.finalize();
    let mut commitment = [0u8; 32];
    commitment.copy_from_slice(&result);
    commitment
}

// Verify passport signature (Placeholder)
pub fn verify_passport_signature(passport: &PassportAttributes) -> bool {
    // TODO: Implement actual signature verification
    !passport.signature.is_empty()
}

// Helper to convert timestamp to Date
pub fn timestamp_to_date(timestamp: u64) -> Date {
    // Simplified conversion
    let year = 1970 + (timestamp / 31536000) as u16;
    let remainder = timestamp % 31536000;
    let month = 1 + (remainder / 2628000) as u8; // Approx
    let day = 1 + ((remainder % 2628000) / 86400) as u8; // Approx
    
    Date { year, month, day }
}