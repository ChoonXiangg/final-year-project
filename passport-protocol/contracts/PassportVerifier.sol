// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISP1Verifier
/// @notice Interface for SP1 Groth16 verifier
interface ISP1Verifier {
    /// @notice Verifies a Groth16 proof
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}

/// @title PassportVerifier
/// @notice Registry for managing verified passport proofs on-chain
/// @dev Stores identity commitments and verification status.
contract PassportVerifier {
    /// @notice The SP1 Groth16 verifier contract address
    address public immutable sp1Verifier;

    /// @notice The verification key hash for the passport verifier program
    bytes32 public immutable passportVKey;

    /// @notice Stores identity commitments that have been verified for age
    mapping(bytes32 => bool) public isAgeVerified;

    /// @notice Stores identity commitments that have been verified for nationality
    mapping(bytes32 => bool) public isNationalityVerified;

    /// @notice Stores identity-to-wallet bindings
    /// @dev Maps identity commitment to wallet address
    mapping(bytes32 => address) public walletBindings;

    /// @notice Emitted when an age verification proof is successfully verified
    event AgeVerified(bytes32 indexed identityCommitment, bool isOverAge, uint256 minAge, address indexed verifier);

    /// @notice Emitted when a nationality verification proof is successfully verified
    event NationalityVerified(bytes32 indexed identityCommitment, string nationality, address indexed verifier);

    /// @notice Emitted when a wallet binding proof is successfully verified
    event WalletBound(bytes32 indexed identityCommitment, address indexed walletAddress);

    /// @notice Custom errors
    error AlreadyVerifiedForAge();
    error AlreadyVerifiedForNationality();
    error AlreadyBoundToWallet();
    error InvalidProof();
    error NotOverRequiredAge();
    error TimestampOutOfRange();
    error WalletMismatch();
    error InvalidMinAge();

    /// @notice Constructor to set the verifier and vkey
    /// @param _sp1Verifier The address of the SP1 Verifier contract
    /// @param _passportVKey The verification key for the passport program
    constructor(address _sp1Verifier, bytes32 _passportVKey) {
        sp1Verifier = _sp1Verifier;
        passportVKey = _passportVKey;
    }

    /// @notice Verifies an age verification proof and stores the identity commitment
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function submitAgeProof(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(sp1Verifier).verifyProof(
            passportVKey,
            publicValues,
            proofBytes
        ) {
            // Decode public values
            // Struct: { bool is_over_min_age; bytes32 identity_commitment; uint256 min_age; uint256 current_timestamp; }
            (
                bool isOverAge,
                bytes32 identityCommitment,
                uint256 minAge,
                uint256 currentTimestamp
            ) = abi.decode(publicValues, (bool, bytes32, uint256, uint256));

            // Validate timestamp (allow 1 hour drift)
            if (currentTimestamp < block.timestamp - 1 hours || currentTimestamp > block.timestamp + 1 hours) {
                revert TimestampOutOfRange();
            }

            // Check if identity was already verified
            if (isAgeVerified[identityCommitment]) {
                revert AlreadyVerifiedForAge();
            }

            // Check if age requirement is met
            if (!isOverAge) {
                revert NotOverRequiredAge();
            }

            // Store the verification
            isAgeVerified[identityCommitment] = true;

            // Emit event
            emit AgeVerified(identityCommitment, isOverAge, minAge, msg.sender);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Verifies a nationality verification proof and stores the identity commitment
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function submitNationalityProof(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(sp1Verifier).verifyProof(
            passportVKey,
            publicValues,
            proofBytes
        ) {
            // Decode public values
            // Struct: { bool is_match; bytes32 identity_commitment; string target_nationality; }
            (
                bool isMatch,
                bytes32 identityCommitment,
                string memory targetNationality
            ) = abi.decode(publicValues, (bool, bytes32, string));

            // Check if identity was already verified
            if (isNationalityVerified[identityCommitment]) {
                revert AlreadyVerifiedForNationality();
            }

            // Check if nationality matches
            if (!isMatch) {
                revert InvalidProof(); // Or a specific error for mismatch
            }

            // Store the verification
            isNationalityVerified[identityCommitment] = true;

            // Emit event
            emit NationalityVerified(identityCommitment, targetNationality, msg.sender);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Binds an identity to a wallet address
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function submitWalletBindingProof(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(sp1Verifier).verifyProof(
            passportVKey,
            publicValues,
            proofBytes
        ) {
            // Decode public values
            // Struct: { bytes32 identity_commitment; address wallet_address; }
            (
                bytes32 identityCommitment,
                address walletAddress
            ) = abi.decode(publicValues, (bytes32, address));

            // Check if msg.sender matches the wallet address in the proof
            if (walletAddress != msg.sender) {
                revert WalletMismatch();
            }

            // Check if identity was already bound
            if (walletBindings[identityCommitment] != address(0)) {
                revert AlreadyBoundToWallet();
            }

            // Store the binding
            walletBindings[identityCommitment] = walletAddress;

            // Emit event
            emit WalletBound(identityCommitment, walletAddress);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Checks if an identity has been verified for age
    function checkAgeVerification(bytes32 identityCommitment) public view returns (bool) {
        return isAgeVerified[identityCommitment];
    }

    /// @notice Checks if an identity has been verified for nationality
    function checkNationalityVerification(bytes32 identityCommitment) public view returns (bool) {
        return isNationalityVerified[identityCommitment];
    }

    /// @notice Gets the wallet address bound to an identity
    function getBoundWallet(bytes32 identityCommitment) public view returns (address) {
        return walletBindings[identityCommitment];
    }
}
