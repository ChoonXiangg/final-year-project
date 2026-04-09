use alloy_sol_types::sol;
use serde::{Deserialize, Serialize};

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
    pub name: String,
    pub sex: String,
}

// SOLIDITY-COMPATIBLE OUTPUT STRUCTS

sol! {
    struct PassportVerificationOutput {
        bytes32 identity_hash;
        address wallet_address;
        address verifier_address;
        bool is_over_min_age;
        uint256 min_age;
        bool is_nationality_match;
        string target_nationality;
        bool is_sex_match;
        string target_sex;
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

// Create a deterministic identity hash from passport attributes.
// Uses name + nationality + date of birth so the hash survives passport renewal.
pub fn derive_identity_hash(passport: &PassportAttributes) -> [u8; 32] {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(passport.name.as_bytes());
    hasher.update(passport.nationality.as_bytes());
    hasher.update(&passport.date_of_birth.year.to_le_bytes());
    hasher.update(&[passport.date_of_birth.month]);
    hasher.update(&[passport.date_of_birth.day]);

    let result = hasher.finalize();
    let mut commitment = [0u8; 32];
    commitment.copy_from_slice(&result);
    commitment
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