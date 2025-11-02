#![no_main]
sp1_zkvm::entrypoint!(main);

use passport_verifier_lib::{
    NationalityVerificationOutput, PassportData, create_passport_commitment,
};

pub fn main() {
    // Read private inputs
    let passport = sp1_zkvm::io::read::<PassportData>();
    let target_nationality = sp1_zkvm::io::read::<String>();
    
    // Perform verification (private computation)
    let is_match = passport.nationality == target_nationality;
    
    // Create passport commitment
    let passport_commitment = create_passport_commitment(&passport);
    
    // Prepare public output
    let output = NationalityVerificationOutput {
        is_target_nationality: is_match,
        passport_commitment: passport_commitment.into(),
    };
    
    // Commit public output
    let bytes = output.abi_encode();
    sp1_zkvm::io::commit_slice(&bytes);
}