use alloy_sol_types::sol;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Date {
    pub year: u16,
    pub month: u8,
    pub day: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PassportAttributes {
    pub document_number: String,
    pub date_of_birth: Date,
    pub date_of_expiry: Date,
    pub nationality: String,
    pub name: String,
    pub sex: String,
}

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

pub fn is_passport_valid(expiry: &Date, current: &Date) -> bool {
    (expiry.year, expiry.month, expiry.day) >= (current.year, current.month, current.day)
}

pub fn calculate_age(birth: &Date, current: &Date) -> u16 {
    let mut age = current.year - birth.year;
    if current.month < birth.month || (current.month == birth.month && current.day < birth.day) {
        age -= 1;
    }
    age
}

// Hashes name + nationality + date of birth so the identity survives passport renewal.
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

pub fn timestamp_to_date(timestamp: u64) -> Date {
    use chrono::{DateTime, Datelike};
    let dt = DateTime::from_timestamp(timestamp as i64, 0)
        .expect("invalid timestamp");
    Date {
        year: dt.year() as u16,
        month: dt.month() as u8,
        day: dt.day() as u8,
    }
}