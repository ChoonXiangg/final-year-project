use clap::Parser;
use passport_verifier_lib::{AgeVerificationOutput, Date, PassportData, VerificationMode};
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

    // Minimum age to verify (default: 18)
    #[arg(long, default_value = "18")]
    min_age: u16,
}

fn main() {
    // Setup logging
    sp1_sdk::utils::setup_logger();

    // Parse command line arguments
    let args = Args::parse();

    // Create passport data from arguments
    let passport = PassportData {
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
    };

    // Current date (in production, this would be fetched from a trusted source)
    let current_date = Date {
        year: 2025,
        month: 11,
        day: 1,
    };

    println!("Generating age verification proof...");
    println!("Passport: {}", passport.document_number);
    println!("Birthdate: {}-{:02}-{:02}", passport.date_of_birth.year, passport.date_of_birth.month, passport.date_of_birth.day);
    println!("Current date: {}-{:02}-{:02}", current_date.year, current_date.month, current_date.day);
    println!("Minimum age: {}", args.min_age);
    println!();

    // Setup prover client
    let client = ProverClient::from_env();

    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&VerificationMode::Age);  // Write mode first
    stdin.write(&passport);
    stdin.write(&current_date);
    stdin.write(&args.min_age);

    // Generate proof
    println!("Proving age verification...");
    let (pk, vk) = client.setup(PASSPORT_ELF);
    let proof = client.prove(&pk, &stdin).run().expect("Failed to generate proof");

    println!("Proof generated successfully!");

    // Verify proof
    println!("Verifying proof...");
    client.verify(&proof, &vk).expect("Failed to verify proof");
    println!("Proof verified successfully!");

    // Decode and display public outputs
    let output = AgeVerificationOutput::abi_decode(&proof.public_values.as_slice()).unwrap();
    println!();
    println!("PUBLIC OUTPUTS:");
    println!("  Is over {} years old: {}", args.min_age, output.is_over_18);
    println!("  Passport commitment: 0x{}", hex::encode(output.passport_commitment));
    println!();
    println!("Age verification complete!");
}