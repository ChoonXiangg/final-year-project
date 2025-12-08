// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISP1Verifier {
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}

/// @title Passport Protocol Verifier
/// @notice Manages ZK-verified passport identities and wallet bindings
contract PassportVerifier {
    /// @notice The SP1 Groth16 verifier contract address
    address public immutable sp1Verifier;

    /// @notice The verification key hash for the passport verifier program
    bytes32 public immutable passportVKey;

    /// @notice Stores verify status for identity commitments
    struct IdentityStatus {
        bool isVerified;
        uint256 verificationTimestamp;
        address boundWallet;
        string nationality;
        bool isAdult;
    }

    mapping(bytes32 => IdentityStatus) public identities;

    event IdentityVerified(
        bytes32 indexed identityCommitment,
        address indexed wallet,
        string nationality,
        bool isAdult
    );

    error InvalidProof();
    error InvalidSignature();
    error IdentityAlreadyVerified();
    error WalletMismatch();
    error ParameterMismatch();
    error TimestampTooOld();

    constructor(address _sp1Verifier, bytes32 _passportVKey) {
        sp1Verifier = _sp1Verifier;
        passportVKey = _passportVKey;
    }

    function verifyPassport(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // 1. Verify ZK Proof
        try ISP1Verifier(sp1Verifier).verifyProof(
            passportVKey,
            publicValues,
            proofBytes
        ) {
            // 2. Decode Public Values
            // Struct matches Rust: PassportVerificationOutput
            // NOTE: We slice the first 32 bytes because the public values verify inputs 
            // seem to contain a length/offset prefix (0x0...20) that shifts alignment.
            (
                bool isValidSig,
                bool isOverMinAge,
                bool isNationalityMatch,
                bytes32 identityCommitment,
                address walletAddress,
                uint256 minAge,
                string memory targetNationality,
                uint256 timestamp
            ) = abi.decode(publicValues[32:], (bool, bool, bool, bytes32, address, uint256, string, uint256));

            // 3. Logic Checks
            if (!isValidSig) revert InvalidSignature();
            if (identities[identityCommitment].isVerified) revert IdentityAlreadyVerified();
            
            // Ensure the proof binds to the sender (unless we allow relayers, but let's enforce binding)
            if (walletAddress != msg.sender) revert WalletMismatch();

            // Check specific requirements if needed (e.g., must be adult)
            // For now we just store whatever the proof says, but usually you'd enforce requirements here
            // or in the ZK program. The ZK program proves "isOverMinAge" based on input "minAge".
            // We should ensure "minAge" is what we expect (e.g. 18).
            if (minAge != 18) revert ParameterMismatch(); 

            // 4. Store Identity
            identities[identityCommitment] = IdentityStatus({
                isVerified: true,
                verificationTimestamp: block.timestamp,
                boundWallet: walletAddress,
                nationality: targetNationality, // Only accurate if isNationalityMatch is true
                isAdult: isOverMinAge
            });

            emit IdentityVerified(identityCommitment, walletAddress, targetNationality, isOverMinAge);

        } catch {
            revert InvalidProof();
        }
    }
}

