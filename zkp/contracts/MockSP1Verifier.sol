// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Mock SP1 Verifier for local testing with mock proofs.
/// Always accepts any proof (used with SP1_PROVER=mock).
contract MockSP1Verifier {
    function verifyProof(
        bytes32, /* programVKey */
        bytes calldata, /* publicValues */
        bytes calldata /* proofBytes */
    ) external pure {
        // Accept everything - mock verifier for local testing
    }
}
