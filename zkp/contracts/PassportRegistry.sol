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

/// @title PassportRegistry
/// @notice Registry for managing verified passport proofs on-chain
/// @dev Stores passport commitments and verification status to prevent double-usage
contract PassportRegistry {
    /// @notice The SP1 Groth16 verifier contract address (deployed by Succinct)
    address public constant SP1_VERIFIER = 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B;

    /// @notice The verification key hash for the passport verifier program
    bytes32 public constant PASSPORT_VKEY = 0x001cb39b2a1dce45a425e1be3ca098e27b1d6dc8b898ee6f6ee1108144eecf1d;

    /// @notice Stores passport commitments that have been verified for age
    mapping(bytes32 => bool) public verifiedAgePassports;

    /// @notice Stores passport commitments that have been verified for nationality
    mapping(bytes32 => bool) public verifiedNationalityPassports;

    /// @notice Stores passport-to-wallet bindings
    mapping(bytes32 => address) public passportWalletBindings;

    /// @notice Emitted when an age verification proof is successfully verified
    event AgeVerified(bytes32 indexed passportCommitment, bool isOverAge, address indexed verifier);

    /// @notice Emitted when a nationality verification proof is successfully verified
    event NationalityVerified(bytes32 indexed passportCommitment, address indexed verifier);

    /// @notice Emitted when a wallet binding proof is successfully verified
    event WalletBound(bytes32 indexed passportCommitment, address indexed walletAddress);

    /// @notice Custom errors
    error PassportAlreadyVerifiedForAge();
    error PassportAlreadyVerifiedForNationality();
    error PassportAlreadyBoundToWallet();
    error InvalidProof();
    error NotOverRequiredAge();

    /// @notice Verifies an age verification proof and stores the passport commitment
    /// @param publicValues The public values (outputs) from the proof containing:
    ///        - bool is_over_18: Whether the passport holder is over the required age
    ///        - bytes32 passport_commitment: The commitment to the passport data
    /// @param proofBytes The Groth16 proof bytes
    function verifyAge(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(SP1_VERIFIER).verifyProof(
            PASSPORT_VKEY,
            publicValues,
            proofBytes
        ) {
            // Decode public values
            (bool isOverAge, bytes32 passportCommitment) = abi.decode(publicValues, (bool, bytes32));

            // Check if passport was already verified
            if (verifiedAgePassports[passportCommitment]) {
                revert PassportAlreadyVerifiedForAge();
            }

            // Check if age requirement is met
            if (!isOverAge) {
                revert NotOverRequiredAge();
            }

            // Store the verification
            verifiedAgePassports[passportCommitment] = true;

            // Emit event
            emit AgeVerified(passportCommitment, isOverAge, msg.sender);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Verifies a nationality verification proof and stores the passport commitment
    /// @param publicValues The public values (outputs) from the proof
    /// @param proofBytes The Groth16 proof bytes
    function verifyNationality(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(SP1_VERIFIER).verifyProof(
            PASSPORT_VKEY,
            publicValues,
            proofBytes
        ) {
            // Decode public values (assuming similar structure to age verification)
            (, bytes32 passportCommitment) = abi.decode(publicValues, (bool, bytes32));

            // Check if passport was already verified
            if (verifiedNationalityPassports[passportCommitment]) {
                revert PassportAlreadyVerifiedForNationality();
            }

            // Store the verification
            verifiedNationalityPassports[passportCommitment] = true;

            // Emit event
            emit NationalityVerified(passportCommitment, msg.sender);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Binds a passport to a wallet address
    /// @param publicValues The public values (outputs) from the proof containing:
    ///        - bytes32 passport_commitment: The commitment to the passport data
    ///        - address wallet_address: The wallet address to bind to
    /// @param proofBytes The Groth16 proof bytes
    function bindWallet(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) public {
        // Verify the proof using SP1 verifier
        try ISP1Verifier(SP1_VERIFIER).verifyProof(
            PASSPORT_VKEY,
            publicValues,
            proofBytes
        ) {
            // Decode public values
            (bytes32 passportCommitment, address walletAddress) = abi.decode(publicValues, (bytes32, address));

            // Check if passport was already bound
            if (passportWalletBindings[passportCommitment] != address(0)) {
                revert PassportAlreadyBoundToWallet();
            }

            // Store the binding
            passportWalletBindings[passportCommitment] = walletAddress;

            // Emit event
            emit WalletBound(passportCommitment, walletAddress);
        } catch {
            revert InvalidProof();
        }
    }

    /// @notice Checks if a passport has been verified for age
    /// @param passportCommitment The passport commitment to check
    /// @return True if the passport has been verified for age
    function isAgeVerified(bytes32 passportCommitment) public view returns (bool) {
        return verifiedAgePassports[passportCommitment];
    }

    /// @notice Checks if a passport has been verified for nationality
    /// @param passportCommitment The passport commitment to check
    /// @return True if the passport has been verified for nationality
    function isNationalityVerified(bytes32 passportCommitment) public view returns (bool) {
        return verifiedNationalityPassports[passportCommitment];
    }

    /// @notice Gets the wallet address bound to a passport
    /// @param passportCommitment The passport commitment to check
    /// @return The wallet address bound to the passport (address(0) if not bound)
    function getBoundWallet(bytes32 passportCommitment) public view returns (address) {
        return passportWalletBindings[passportCommitment];
    }
}
