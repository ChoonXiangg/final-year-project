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
            // Handle potentially dynamic prefix length (SP1 sometimes adds 32 bytes offset)
            bytes memory dataToDecode = publicValues;
            // Check if the first word is 0x20 (32). If so, it's likely an offset/length prefix we should skip.
            if (publicValues.length > 32) {
                 uint256 firstWord;
                 assembly {
                     firstWord := mload(add(publicValues, 32)) 
                 }
                 if (firstWord == 32) {
                     // Slice off the first 32 bytes
                     // NOTE: In strict solidity we can't easily slice 'calldata'. 
                     // We would need to copy to memory or adjust the offset logic.
                     // A safer way for calldata slicing:
                     dataToDecode = publicValues[32:];
                 }
            }

            (
                bool isValidSig,
                bool isOverMinAge,
                bool isNationalityMatch,
                bytes32 identityCommitment,
                address walletAddress,
                uint256 minAge,
                string memory targetNationality,
                uint256 timestamp
            ) = abi.decode(dataToDecode, (bool, bool, bool, bytes32, address, uint256, string, uint256));

            // 3. Logic Checks
            if (!isValidSig) revert InvalidSignature();

            // Replay Protection: Proof must be recent (within 30 days)
            // This prevents using an old proof after the passport might have expired or been revoked
            if (timestamp > block.timestamp || block.timestamp - timestamp > 30 days) {
                revert TimestampTooOld();
            }

            if (identities[identityCommitment].isVerified && identities[identityCommitment].boundWallet != msg.sender) {
                revert IdentityAlreadyVerified();
            }
            
            // Ensure the proof binds to the sender (unless we allow relayers, but let's enforce binding)
            if (walletAddress != msg.sender) revert WalletMismatch();

            // Check specific requirements if needed (e.g., must be adult)
            // We should ensure "minAge" is what we expect (e.g. 18).
            if (minAge != 18) revert ParameterMismatch(); 

            // 4. Store Identity
            identities[identityCommitment] = IdentityStatus({
                isVerified: true,
                verificationTimestamp: block.timestamp,
                boundWallet: walletAddress,
                // CRITICAL: Only store the nationality if the proof actually confirmed it matches!
                // Otherwise a user could input "US", fail the match, but have "US" stored on-chain.
                nationality: isNationalityMatch ? targetNationality : "", 
                isAdult: isOverMinAge
            });

            emit IdentityVerified(identityCommitment, walletAddress, isNationalityMatch ? targetNationality : "", isOverMinAge);

        } catch {
            revert InvalidProof();
        }
    }
}