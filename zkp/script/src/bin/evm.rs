use passport_verifier_lib::{Date, PassportAttributes};
use sp1_sdk::{ProverClient, SP1Stdin, HashableKey};
use std::time::Instant;
use passport_verifier_script::utils::*;
use serde::Deserialize;

const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PassportInput {
    document_number: String,
    birth_year: u16,
    birth_month: u8,
    birth_day: u8,
    expiry_year: u16,
    expiry_month: u8,
    expiry_day: u8,
    nationality: String,
    name: String,
    sex: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerificationRequirements {
    wallet_address: String,
    verifier_address: String,
    required_age: u16,
    required_nationality: String,
    required_sex: String,
}

fn main() {
    std::env::set_var("RUST_LOG", "debug");
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    print_banner();
    print_step("Initializing SP1 Prover (EVM Mode)...");

    let passport_input: PassportInput = serde_json::from_reader(std::io::stdin())
        .expect("Failed to parse passport JSON from stdin");

    let reqs_path = "../verification_requirements.json";
    let reqs_file = std::fs::File::open(reqs_path).unwrap_or_else(|_| panic!("Failed to open {}", reqs_path));
    let reqs: VerificationRequirements = serde_json::from_reader(reqs_file).expect("Failed to parse verification_requirements.json");

    print_info("Document", &passport_input.document_number);
    print_info("Binding To", &reqs.wallet_address);

    let passport = PassportAttributes {
        document_number: passport_input.document_number,
        date_of_birth: Date {
            year: passport_input.birth_year,
            month: passport_input.birth_month,
            day: passport_input.birth_day,
        },
        date_of_expiry: Date { 
            year: passport_input.expiry_year, 
            month: passport_input.expiry_month, 
            day: passport_input.expiry_day 
        }, 
        nationality: passport_input.nationality,
        name: passport_input.name,
        sex: passport_input.sex,
    };

    let wallet_bytes = hex::decode(reqs.wallet_address.trim_start_matches("0x")).expect("Invalid wallet address");
    let mut wallet_array = [0u8; 20];
    wallet_array.copy_from_slice(&wallet_bytes);

    let verifier_bytes = hex::decode(reqs.verifier_address.trim_start_matches("0x")).expect("Invalid verifier address");
    let mut verifier_array = [0u8; 20];
    verifier_array.copy_from_slice(&verifier_bytes);
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

    let client = ProverClient::from_env();
    let (pk, vk) = client.setup(PASSPORT_ELF);
    print_success("Prover initialized");

    let mut stdin = SP1Stdin::new();
    stdin.write(&passport);
    stdin.write(&wallet_array);
    stdin.write(&verifier_array);
    stdin.write(&now);
    stdin.write(&reqs.required_age);
    stdin.write(&reqs.required_nationality);
    stdin.write(&reqs.required_sex);

    print_step("Generating EVM Proof (Groth16)...");
    let start = Instant::now();
    let proof = client.prove(&pk, &stdin).groth16().run().expect("Groth16 proof failed");

    print_success(&format!("Proof generated in {:.2?}", start.elapsed()));

    let proof_dir = "../proofs";
    std::fs::create_dir_all(proof_dir).unwrap();

    let job_id = std::env::var("PROOF_JOB_ID").unwrap_or_else(|_| "default".to_string());
    let proof_filename = format!("passport_proof_evm_{}.json", job_id);

    let proof_bytes = proof.bytes();
    let public_values = proof.public_values.as_slice();

    // In SP1 mock mode, Groth16 encoded proof bytes are not generated.
    // Use a single zero byte so the flow proceeds with MockSP1Verifier (which ignores proof bytes).
    let proof_hex = if proof_bytes.is_empty() {
        print_step("Mock mode detected: using placeholder proof bytes (deploy MockSP1Verifier on-chain)");
        "00".to_string()
    } else {
        hex::encode(&proof_bytes)
    };

    let proof_data = serde_json::json!({
        "proof": proof_hex,
        "publicValues": hex::encode(public_values),
        "vkey": vk.bytes32()
    });
    std::fs::write(
        format!("{}/{}", proof_dir, proof_filename),
        serde_json::to_string_pretty(&proof_data).unwrap(),
    ).unwrap();

    print_success(&format!("Proof saved to {}/{}", proof_dir, proof_filename));
}
