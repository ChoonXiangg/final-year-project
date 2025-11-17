use clap::Parser;
use passport_verifier_lib::{AgeVerificationOutput, Date, PassportData, VerificationMode};
use sp1_sdk::{ProverClient, SP1Stdin};
use alloy_sol_types::SolValue;
use chrono::{Local, Datelike};

/// ELF binary for the passport verification program
const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate Groth16 proof for age verification")]
struct Args {
    /// Passport document number
    #[arg(long)]
    document_number: String,

    /// Birth year
    #[arg(long)]
    birth_year: u16,

    /// Birth month (1-12)
    #[arg(long)]
    birth_month: u8,

    /// Birth day (1-31)
    #[arg(long)]
    birth_day: u8,

    /// Nationality
    #[arg(long)]
    nationality: String,

    /// Given names
    #[arg(long)]
    given_names: String,

    /// Surname
    #[arg(long)]
    surname: String,

    /// Expiry year
    #[arg(long)]
    expiry_year: u16,

    /// Expiry month (1-12)
    #[arg(long)]
    expiry_month: u8,

    /// Expiry day (1-31)
    #[arg(long)]
    expiry_day: u8,

    /// Minimum age to verify (default: 18)
    #[arg(long, default_value = "18")]
    min_age: u16,

    /// Output file for proof (default: proof.bin)
    #[arg(long, default_value = "proof.bin")]
    output: String,
}

fn main() {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    // Setup logging
    sp1_sdk::utils::setup_logger();

    // Parse command line arguments
    let args = Args::parse();

    // Create passport data
    let passport = PassportData {
        document_number: args.document_number,
        date_of_birth: Date {
            year: args.birth_year,
            month: args.birth_month,
            day: args.birth_day,
        },
        date_of_expiry: Date {
            year: args.expiry_year,
            month: args.expiry_month,
            day: args.expiry_day,
        },
        nationality: args.nationality,
        given_names: args.given_names,
        surname: args.surname,
    };

    // Get current date
    let now = Local::now();
    let current_date = Date {
        year: now.year() as u16,
        month: now.month() as u8,
        day: now.day() as u8,
    };

    println!("GENERATING GROTH16 PROOF FOR EVM");
    println!("Passport: {}", passport.document_number);
    println!("Birthdate: {}-{:02}-{:02}", passport.date_of_birth.year, passport.date_of_birth.month, passport.date_of_birth.day);
    println!("Expiry date: {}-{:02}-{:02}", passport.date_of_expiry.year, passport.date_of_expiry.month, passport.date_of_expiry.day);
    println!("Current date: {}-{:02}-{:02}", current_date.year, current_date.month, current_date.day);
    println!("Minimum age: {}", args.min_age);

    // Setup prover client
    let client = ProverClient::from_env();

    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&VerificationMode::Age);
    stdin.write(&passport);
    stdin.write(&current_date);
    stdin.write(&args.min_age);

    // Generate Groth16 proof
    println!("[1/3] Setting up proving key...");
    let (pk, vk) = client.setup(PASSPORT_ELF);

    println!("[2/3] Generating Groth16 proof...");

    let proof = client
        .prove(&pk, &stdin)
        .groth16()  // Generate Groth16 proof for EVM
        .run()
        .expect("Failed to generate Groth16 proof");

    println!("[3/3] Verifying proof...");
    client.verify(&proof, &vk).expect("Failed to verify proof");

    // Decode public outputs
    let output = AgeVerificationOutput::abi_decode(&proof.public_values.as_slice())
        .expect("Failed to decode public values");

    println!("PROOF GENERATION SUCCESSFUL!");
    println!("Is over {} years old: {}", args.min_age, output.is_over_18);
    println!("Passport commitment: 0x{}", hex::encode(output.passport_commitment));

    // Save proof to file
    println!("Saving proof to: {}", args.output);
    std::fs::write(&args.output, proof.bytes())
        .expect("Failed to write proof to file");

    println!("Groth16 proof saved successfully!");
    println!("Proof file: {}", args.output);
    println!("\nNext step: Extract verification key with vkey binary");
}
