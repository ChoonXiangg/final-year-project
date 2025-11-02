#![no_main]
sp1_zkvm::entrypoint!(main);

use passport_verifier_lib::{
    AgeVerificationOutput, Date, PassportData, calculate_age, create_passport_commitment,
};

pub fn main() {
    // Read private inputs from the prover
    let passport = sp1_zkvm::io::read::<PassportData>();
    let current_date = sp1_zkvm::io::read::<Date>();
    let min_age = sp1_zkvm::io::read::<u16>();  // e.g., 18
    
    // Calculate age (this computation is private, not revealed)
    let age = calculate_age(&passport.date_of_birth, &current_date);
    
    // Perform verification
    let is_over_min_age = age >= min_age;
    
    // Create passport commitment for linking proofs
    let passport_commitment = create_passport_commitment(&passport);
    
    // Prepare public output
    let output = AgeVerificationOutput {
        is_over_18: is_over_min_age,
        passport_commitment: passport_commitment.into(),
    };
    
    // Commit public output (this is what the verifier sees)
    let bytes = output.abi_encode();
    sp1_zkvm::io::commit_slice(&bytes);
}