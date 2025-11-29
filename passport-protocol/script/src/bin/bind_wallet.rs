use clap::Parser;
use passport_verifier_lib::{Date, PassportAttributes, WalletLinkOutput, ProofType};
use sp1_sdk::{ProverClient, SP1Stdin};
use alloy_sol_types::SolValue;

// ELF binary for the passport verification program
const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    // Passport document number
    #[arg(long)]
    document_number: String,

    // Birth year
    #[arg(long)]
    birth_year: u16,

    // Birth month (1-12)
    #[arg(long)]
    birth_month: u8,

    // Birth day (1-31)
    #[arg(long)]
    birth_day: u8,

    // Nationality
    #[arg(long)]
    nationality: String,

    // Given names
    #[arg(long)]
    given_names: String,

    // Surname
    #[arg(long)]
    surname: String,

    // Wallet address (Ethereum format, without 0x prefix)
    #[arg(long)]
    wallet_address: String,
}

fn main() {
    // Setup logging
    sp1_sdk::utils::setup_logger();

    // Parse command line arguments
    let args = Args::parse();

    // Parse wallet address
    let wallet_hex = args.wallet_address.trim_start_matches("0x");
    let wallet_bytes = hex::decode(wallet_hex).expect("Invalid wallet address hex");
    if wallet_bytes.len() != 20 {
        panic!("Wallet address must be 20 bytes (40 hex characters)");
    }
    let mut wallet_address = [0u8; 20];
    wallet_address.copy_from_slice(&wallet_bytes);

    // Create passport data from arguments
    let passport = PassportAttributes {
        document_number: args.document_number,
        date_of_birth: Date {
            year: args.birth_year,
            month: args.birth_month,
            day: args.birth_day,
        },
        date_of_expiry: Date {
            year: 2030,
            month: 12,
            day: 31,
        },
        nationality: args.nationality,
        given_names: args.given_names,
        surname: args.surname,
        signature: vec![0xde, 0xad, 0xbe, 0xef], // Dummy signature
        signed_attributes: vec![],
    };

    println!("Generating wallet binding proof...");
    println!("Passport: {}", passport.document_number);
    println!("Name: {} {}", passport.given_names, passport.surname);
    println!("Wallet: 0x{}", hex::encode(wallet_address));
    println!();

    // Setup prover client
    let client = ProverClient::from_env();

    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&ProofType::WalletLink);  // Write mode first
    stdin.write(&passport);
    stdin.write(&wallet_address);

    // Generate proof
    println!("Proving wallet binding...");
    let (pk, vk) = client.setup(PASSPORT_ELF);
    let proof = client.prove(&pk, &stdin).run().expect("Failed to generate proof");

    println!("Proof generated successfully!");

    // Verify proof
    println!("Verifying proof...");
    client.verify(&proof, &vk).expect("Failed to verify proof");
    println!("Proof verified successfully!");

    // Decode and display public outputs
    let output = WalletLinkOutput::abi_decode(proof.public_values.as_slice()).unwrap();
    println!();
    println!("PUBLIC OUTPUTS:");
    println!("  Identity commitment: 0x{}", hex::encode(output.identity_commitment));
    println!("  Wallet address: 0x{}", hex::encode(output.wallet_address));
    println!();
    println!("This commitment can be stored on-chain to prevent sybil attacks!");
    println!("   Same passport + different wallet = same identity commitment (but contract prevents rebinding)");
    println!();
    println!("Wallet binding complete!");
}