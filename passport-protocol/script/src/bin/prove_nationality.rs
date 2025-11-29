use clap::Parser;
use passport_verifier_lib::{Date, NationalityCheckOutput, PassportAttributes, ProofType};
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

    // Target nationality to verify against
    #[arg(long)]
    target_nationality: String,
}

fn main() {
    // Setup logging
    sp1_sdk::utils::setup_logger();

    // Parse command line arguments
    let args = Args::parse();

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

    println!("Generating nationality verification proof...");
    println!("Passport: {}", passport.document_number);
    println!("Actual nationality: {}", passport.nationality);
    println!("Target nationality: {}", args.target_nationality);
    println!();

    // Setup prover client
    let client = ProverClient::from_env();

    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&ProofType::NationalityCheck);  // Write mode first
    stdin.write(&passport);
    stdin.write(&args.target_nationality);

    // Generate proof
    println!("Proving nationality verification...");
    let (pk, vk) = client.setup(PASSPORT_ELF);
    let proof = client.prove(&pk, &stdin).run().expect("Failed to generate proof");

    println!("Proof generated successfully!");

    // Verify proof
    println!("Verifying proof...");
    client.verify(&proof, &vk).expect("Failed to verify proof");
    println!("Proof verified successfully!");

    // Decode and display public outputs
    let output = NationalityCheckOutput::abi_decode(proof.public_values.as_slice()).unwrap();
    println!();
    println!("PUBLIC OUTPUTS:");
    println!("  Is match: {}", output.is_match);
    println!("  Target nationality: {}", output.target_nationality);
    println!("  Identity commitment: 0x{}", hex::encode(output.identity_commitment));
    println!();
    println!("Nationality verification complete!");
}