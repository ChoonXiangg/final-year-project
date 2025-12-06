use passport_verifier_lib::{Date, PassportAttributes, ProofType};
use sp1_sdk::{ProverClient, SP1Stdin, HashableKey};
use std::time::Instant;
use passport_verifier_script::utils::*;
use alloy_sol_types::SolValue;
use serde::Deserialize;

const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")] 
struct MockPassport {
    document_number: String,
    birth_year: u16,
    birth_month: u8,
    birth_day: u8,
    expiry_year: u16,
    expiry_month: u8,
    expiry_day: u8,
    nationality: String,
    given_names: String,
    surname: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerificationRequirements {
    wallet_address: String,
    required_age: u16,
    required_nationality: String,
}

fn main() {
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    print_banner();
    print_step("Initializing SP1 Prover (EVM Mode)...");

    // Read Input Files
    // Files are located in the root of the project, while this script runs from script/
    let passport_path = "../mock_passport.json";
    let reqs_path = "../verification_requirements.json";
    
    let passport_file = std::fs::File::open(passport_path).unwrap_or_else(|_| panic!("Failed to open {}", passport_path));
    let reqs_file = std::fs::File::open(reqs_path).unwrap_or_else(|_| panic!("Failed to open {}", reqs_path));

    let mock_passport: MockPassport = serde_json::from_reader(passport_file).expect("Failed to parse mock_passport.json");
    let reqs: VerificationRequirements = serde_json::from_reader(reqs_file).expect("Failed to parse verification_requirements.json");

    print_info("Document", &mock_passport.document_number);
    print_info("Binding To", &reqs.wallet_address);

    // Setup inputs
    let passport = PassportAttributes {
        document_number: mock_passport.document_number,
        date_of_birth: Date {
            year: mock_passport.birth_year,
            month: mock_passport.birth_month,
            day: mock_passport.birth_day,
        },
        date_of_expiry: Date { 
            year: mock_passport.expiry_year, 
            month: mock_passport.expiry_month, 
            day: mock_passport.expiry_day 
        }, 
        nationality: mock_passport.nationality,
        given_names: mock_passport.given_names,
        surname: mock_passport.surname,
        signature: vec![0xde, 0xad, 0xbe, 0xef], // Mock signature
        signed_attributes: vec![],
    };

    let wallet_bytes = hex::decode(reqs.wallet_address.trim_start_matches("0x")).expect("Invalid wallet address");
    let mut wallet_array = [0u8; 20];
    wallet_array.copy_from_slice(&wallet_bytes);
    
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

    let client = ProverClient::from_env();
    let (pk, vk) = client.setup(PASSPORT_ELF);
    print_success("Prover initialized");

    let mut stdin = SP1Stdin::new();
    stdin.write(&ProofType::ProofOfPassport);
    stdin.write(&passport);
    stdin.write(&wallet_array);
    stdin.write(&now);
    stdin.write(&reqs.required_age);
    stdin.write(&reqs.required_nationality);

    print_step("Generating EVM Proof (Groth16)...");
    let start = Instant::now();
    
    // Generate proof - Force Groth16 for Sepolia
    let proof = client.prove(&pk, &stdin).groth16().run().expect("Groth16 proof failed");

    print_success(&format!("Proof generated in {:.2?}", start.elapsed()));

    // Save proof to root/proofs
    let proof_dir = "../proofs";
    std::fs::create_dir_all(proof_dir).unwrap();
    
    let proof_bytes = proof.bytes();
    let public_values = proof.public_values.as_slice();
    
    let proof_data = serde_json::json!({
        "proof": hex::encode(&proof_bytes),
        "publicValues": hex::encode(public_values),
        "vkey": vk.bytes32()
    });
    std::fs::write(format!("{}/passport_proof_evm.json", proof_dir), serde_json::to_string_pretty(&proof_data).unwrap()).unwrap();
    
    print_success(&format!("Proof saved to {}/passport_proof_evm.json", proof_dir));
}
