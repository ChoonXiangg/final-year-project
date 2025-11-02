#![no_main]
sp1_zkvm::entrypoint!(main);

use passport_verifier_lib::{
    WalletBindingOutput, PassportData, create_wallet_binding,
};

pub fn main() {
    // Read private inputs
    let passport = sp1_zkvm::io::read::<PassportData>();
    let wallet_address = sp1_zkvm::io::read::<[u8; 20]>();  // Ethereum address
    
    // Create deterministic binding commitment
    // Same passport + same wallet = same commitment (idempotent)
    // Same passport + different wallet = different commitment (sybil prevention)
    let binding_commitment = create_wallet_binding(&passport, &wallet_address);
    
    // Prepare public output
    let output = WalletBindingOutput {
        binding_commitment: binding_commitment.into(),
        wallet_address: wallet_address.into(),
    };
    
    // Commit public output
    let bytes = output.abi_encode();
    sp1_zkvm::io::commit_slice(&bytes);
}