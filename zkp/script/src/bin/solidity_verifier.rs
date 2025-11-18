use sp1_sdk::{HashableKey, ProverClient};

/// ELF binary for the passport verification program
const PASSPORT_ELF: &[u8] = include_bytes!("../../../target/elf-compilation/riscv32im-succinct-zkvm-elf/release/passport-verifier-program");

fn main() {
    // Setup logging
    sp1_sdk::utils::setup_logger();

    println!("Generating Solidity verifier contract template for Groth16 proofs...");

    // Setup prover client
    let client = ProverClient::from_env();

    // Generate proving and verifying keys
    println!("Setting up verification key...");
    let (_, vk) = client.setup(PASSPORT_ELF);

    let vkey_hash = vk.bytes32();
    println!("VKey Hash: {}", vkey_hash);

    // Create Solidity verifier contract template
    println!("\nCreating Solidity verifier contract template...");

    let solidity_template = format!(r#"// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISP1Verifier
/// @notice Interface for SP1 Groth16 verifier
interface ISP1Verifier {{
    /// @notice Verifies a Groth16 proof
    /// @param programVKey The verification key for the SP1 program
    /// @param publicValues The public values from the proof
    /// @param proofBytes The Groth16 proof bytes
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}}

/// @title SP1VerifierGateway
/// @notice Gateway contract for verifying SP1 Groth16 proofs
/// @dev Uses the Succinct-deployed SP1 Groth16 verifier
contract SP1VerifierGateway {{
    /// @notice The SP1 Groth16 verifier contract address (deployed by Succinct)
    /// @dev For Sepolia: Use the address from https://docs.succinct.xyz/onchain-verification/contract-addresses
    /// @dev For Mainnet: Use the address from https://docs.succinct.xyz/onchain-verification/contract-addresses
    address public constant SP1_VERIFIER = address(0); // TODO: Set this to the deployed verifier address

    /// @notice The verification key hash for the passport verifier program
    bytes32 public constant PASSPORT_VKEY = {};

    /// @notice Emitted when a proof is successfully verified
    event ProofVerified(bytes32 indexed vkey, bytes publicValues);

    /// @notice Verifies a Groth16 proof for the passport verifier program
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function verifyPassportProof(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public view {{
        ISP1Verifier(SP1_VERIFIER).verifyProof(
            PASSPORT_VKEY,
            publicValues,
            proofBytes
        );
    }}
}}
"#, vkey_hash);

    // Create contracts directory
    std::fs::create_dir_all("contracts")
        .expect("Failed to create contracts directory");

    // Save verifier gateway
    let gateway_path = "contracts/SP1VerifierGateway.sol";
    std::fs::write(gateway_path, &solidity_template)
        .expect("Failed to write Solidity verifier to file");

    println!("Solidity verifier gateway saved to: {}", gateway_path);
    println!("\nContract details:");
    println!("  - VKey Hash: {}", vkey_hash);
    println!("  - Type: SP1 Groth16 verifier gateway");
    println!("  - Uses Succinct's deployed verifier contract");
    println!("  - Gas cost: ~270k gas per verification");
    println!("\nNOTE: You need to set SP1_VERIFIER address from:");
    println!("  https://docs.succinct.xyz/onchain-verification/contract-addresses");
    println!("\nNext step: Create PassportRegistry smart contract");
}
