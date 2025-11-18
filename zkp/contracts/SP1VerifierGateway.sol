// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISP1Verifier
/// @notice Interface for SP1 Groth16 verifier
interface ISP1Verifier {
    /// @notice Verifies a Groth16 proof
    /// @param programVKey The verification key for the SP1 program
    /// @param publicValues The public values from the proof
    /// @param proofBytes The Groth16 proof bytes
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}

/// @title SP1VerifierGateway
/// @notice Gateway contract for verifying SP1 Groth16 proofs
/// @dev Uses the Succinct-deployed SP1 Groth16 verifier
contract SP1VerifierGateway {
    /// @notice The SP1 Groth16 verifier contract address (deployed by Succinct)
    address public constant SP1_VERIFIER = 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B

    /// @notice The verification key hash for the passport verifier program
    bytes32 public constant PASSPORT_VKEY = 0x001cb39b2a1dce45a425e1be3ca098e27b1d6dc8b898ee6f6ee1108144eecf1d;

    /// @notice Emitted when a proof is successfully verified
    event ProofVerified(bytes32 indexed vkey, bytes publicValues);

    /// @notice Verifies a Groth16 proof for the passport verifier program
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function verifyPassportProof(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public view {
        ISP1Verifier(SP1_VERIFIER).verifyProof(
            PASSPORT_VKEY,
            publicValues,
            proofBytes
        );
    }
}
