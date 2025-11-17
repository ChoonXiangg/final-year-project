use sp1_sdk::{HashableKey, ProverClient};

/// ELF binary for the passport verification program
const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

fn main() {
    // Setup logging
    sp1_sdk::utils::setup_logger();

    println!("Extracting verification key for Groth16 proof...");

    // Setup prover client
    let client = ProverClient::from_env();

    // Generate proving and verifying keys
    let (_, vk) = client.setup(PASSPORT_ELF);

    // Print the verification key
    println!("\nVerification Key:");
    println!("VKey Hash: {}", vk.bytes32());

    // Save to file
    let vkey_bytes = serde_json::to_string_pretty(&vk)
        .expect("Failed to serialize verification key");

    std::fs::write("vkey.json", &vkey_bytes)
        .expect("Failed to write verification key to file");

    println!("\nVerification key saved to: vkey.json");
    println!("This verification key can be used for both regular and Groth16 proofs");
    println!("\nNext step: Generate Solidity verifier contract");
}
