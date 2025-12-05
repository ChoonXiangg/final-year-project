use clap::Parser;
use passport_verifier_lib::{Date, PassportAttributes, PassportVerificationOutput, ProofType};
use sp1_sdk::{ProverClient, SP1Stdin};
use alloy_sol_types::SolValue;
use std::time::Instant;

use passport_verifier_script::utils::*;

// ELF binary for the passport verification program
const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    // Passport document number
    #[arg(long, default_value = "A12345678")]
    document_number: String,

    // Birth year
    #[arg(long, default_value = "1994")]
    birth_year: u16,

    // Birth month (1-12)
    #[arg(long, default_value = "11")]
    birth_month: u8,

    // Birth day (1-31)
    #[arg(long, default_value = "17")]
    birth_day: u8,

    // Nationality
    #[arg(long, default_value = "MYS")]
    nationality: String,

    // Wallet address to bind
    #[arg(long, default_value = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")]
    wallet: String,

    // Minimum age to verify
    #[arg(long, default_value = "18")]
    min_age: u16,

    // Target nationality to verify
    #[arg(long, default_value = "MYS")]
    target_nationality: String,
}

fn main() {
    sp1_sdk::utils::setup_logger();
    let args = Args::parse();

    print_banner();

    // 1. Prepare Data
    print_divider();
    print_step("Preparing passport data...");
    
    let passport = PassportAttributes {
        document_number: args.document_number.clone(),
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
        nationality: args.nationality.clone(),
        given_names: "JOHN".to_string(),
        surname: "DOE".to_string(),
        signature: vec![0xde, 0xad, 0xbe, 0xef],
        signed_attributes: vec![],
    };

    let wallet_bytes = hex::decode(args.wallet.trim_start_matches("0x")).expect("Invalid wallet address");
    let mut wallet_array = [0u8; 20];
    wallet_array.copy_from_slice(&wallet_bytes);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    print_info("Document", &args.document_number);
    print_info("Nationality", &args.nationality);
    print_info("Born", &format!("{}-{:02}-{:02}", args.birth_year, args.birth_month, args.birth_day));
    print_info("Wallet", &args.wallet);
    print_info("Min Age", &args.min_age.to_string());
    print_info("Target Nat", &args.target_nationality);
    
    // 2. Setup Prover
    print_divider();
    print_step("Initializing SP1 Prover...");
    let client = ProverClient::from_env();
    let (pk, vk) = client.setup(PASSPORT_ELF);
    print_success("Prover initialized");

    // 3. Prepare Inputs
    let mut stdin = SP1Stdin::new();
    stdin.write(&ProofType::ProofOfPassport);
    stdin.write(&passport);
    stdin.write(&wallet_array);
    stdin.write(&now);
    stdin.write(&args.min_age);
    stdin.write(&args.target_nationality);

    // 4. Generate Proof
    print_divider();
    print_step("Generating ZK Proof (this may take a minute)...");
    let start = Instant::now();
    
    let proof_result = client.prove(&pk, &stdin).run();
    
    match proof_result {
        Ok(proof) => {
            let duration = start.elapsed();
            print_success(&format!("Proof generated in {:.2?}", duration));

            // 5. Verify Proof
            print_step("Verifying proof validity...");
            match client.verify(&proof, &vk) {
                Ok(_) => print_success("Proof is valid!"),
                Err(e) => print_error(&format!("Proof verification failed: {}", e)),
            }

            // 6. Decode Outputs
            print_divider();
            match PassportVerificationOutput::abi_decode(proof.public_values.as_slice()) {
                Ok(output) => {
                    print_step("Verified Public Outputs:");
                    print_info("Signature Valid", &output.is_valid_signature.to_string());
                    print_info("Age Requirement Met", &output.is_over_min_age.to_string());
                    print_info("Nationality Match", &output.is_nationality_match.to_string());
                    print_info("Wallet Bound", &format!("0x{}", hex::encode(output.wallet_address)));
                    
                    // Save proof
                    let proof_path = "proofs/passport_proof.json";
                    let proof_data = serde_json::json!({
                        "proof": hex::encode(proof.bytes()),
                        "publicValues": hex::encode(proof.public_values.as_slice())
                    });
                    std::fs::create_dir_all("proofs").unwrap();
                    std::fs::write(proof_path, serde_json::to_string_pretty(&proof_data).unwrap()).unwrap();
                    print_success(&format!("Proof saved to {}", proof_path));
                },
                Err(e) => print_error(&format!("Failed to decode output: {}", e)),
            }
        },
        Err(e) => {
            print_error(&format!("Proof generation failed: {}", e));
        }
    }
    print_divider();
}
