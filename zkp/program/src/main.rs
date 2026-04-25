#![no_main]
sp1_zkvm::entrypoint!(main);

use alloy_sol_types::SolValue;
use passport_verifier_lib::*;
use alloy_sol_types::private::U256;

pub fn main() {
    let passport = sp1_zkvm::io::read::<PassportAttributes>();
    let wallet_address = sp1_zkvm::io::read::<[u8; 20]>();
    let verifier_address = sp1_zkvm::io::read::<[u8; 20]>();
    let current_timestamp = sp1_zkvm::io::read::<u64>();
    let min_age = sp1_zkvm::io::read::<u16>();
    let target_nationality = sp1_zkvm::io::read::<String>();
    let target_sex = sp1_zkvm::io::read::<String>();

    let current_date = timestamp_to_date(current_timestamp);
    assert!(is_passport_valid(&passport.date_of_expiry, &current_date), "passport is expired");

    let age = calculate_age(&passport.date_of_birth, &current_date);
    let is_over_min_age = age >= min_age;
    let is_nationality_match = passport.nationality == target_nationality;
    let is_sex_match = passport.sex == target_sex;
    let identity_hash = derive_identity_hash(&passport);

    let output = PassportVerificationOutput {
        identity_hash: identity_hash.into(),
        wallet_address: wallet_address.into(),
        verifier_address: verifier_address.into(),
        is_over_min_age,
        min_age: U256::from(min_age),
        is_nationality_match,
        target_nationality,
        is_sex_match,
        target_sex,
        current_timestamp: U256::from(current_timestamp),
    };

    let bytes = PassportVerificationOutput::abi_encode(&output);
    sp1_zkvm::io::commit_slice(&bytes);
}
