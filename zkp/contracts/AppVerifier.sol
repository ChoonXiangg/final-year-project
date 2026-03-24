// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassportRegistry.sol";

interface ISP1Verifier {
    function verifyProof(
        bytes32 programVKey,
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external view;
}

/// @title App Verifier
/// @notice Per-app verifier with public requirement storage. Verifies ZK proofs and registers identities.
contract AppVerifier {
    PassportRegistry public immutable registry;
    address public immutable sp1Verifier;
    bytes32 public immutable passportVKey;

    // Requirements — public and on-chain
    bool public requireAge;
    bool public requireNationality;
    bool public requireSex;
    uint256 public minAge;
    string public targetNationality;
    string public targetSex;

    constructor(
        address _registry,
        address _sp1Verifier,
        bytes32 _passportVKey,
        bool _requireAge,
        uint256 _minAge,
        bool _requireNationality,
        string memory _targetNationality,
        bool _requireSex,
        string memory _targetSex
    ) {
        registry = PassportRegistry(_registry);
        sp1Verifier = _sp1Verifier;
        passportVKey = _passportVKey;
        requireAge = _requireAge;
        minAge = _minAge;
        requireNationality = _requireNationality;
        targetNationality = _targetNationality;
        requireSex = _requireSex;
        targetSex = _targetSex;
    }

    mapping(address => bool) public verified;

    error InvalidProof();
    error VerifierMismatch();
    error WalletMismatch();
    error TimestampTooOld();
    error RequirementNotMet();

    event ClaimVerified(
        bytes32 indexed identityCommitment,
        address indexed wallet,
        address indexed verifierAddress,
        uint256 timestamp
    );

    function verifyClaim(
        bytes calldata publicValues,
        bytes calldata proofBytes
    ) external {
        // 1. Verify ZK proof
        try ISP1Verifier(sp1Verifier).verifyProof(
            passportVKey,
            publicValues,
            proofBytes
        ) {
            // 2. Decode public values
            bytes calldata dataToDecode = publicValues;
            if (publicValues.length > 32) {
                uint256 firstWord;
                assembly {
                    firstWord := calldataload(publicValues.offset)
                }
                if (firstWord == 32) {
                    dataToDecode = publicValues[32:];
                }
            }

            (
                bytes32 identityCommitment,
                address walletAddress,
                address verifierAddress,
                bool isOverMinAge,
                uint256 proofMinAge,
                bool isNationalityMatch,
                string memory proofNationality,
                bool isSexMatch,
                string memory proofSex,
                uint256 timestamp
            ) = abi.decode(dataToDecode, (bytes32, address, address, bool, uint256, bool, string, bool, string, uint256));

            // 3. Check verifier address matches this contract
            if (verifierAddress != address(this)) revert VerifierMismatch();

            // 4. Check wallet matches sender
            if (walletAddress != msg.sender) revert WalletMismatch();

            // 5. Check timestamp is recent (within 30 days)
            if (timestamp > block.timestamp || block.timestamp - timestamp > 30 days) {
                revert TimestampTooOld();
            }

            // 6. Match claims against stored requirements
            if (requireAge) {
                if (!isOverMinAge || proofMinAge != minAge) revert RequirementNotMet();
            }
            if (requireNationality) {
                if (!isNationalityMatch || keccak256(bytes(proofNationality)) != keccak256(bytes(targetNationality))) revert RequirementNotMet();
            }
            if (requireSex) {
                if (!isSexMatch || keccak256(bytes(proofSex)) != keccak256(bytes(targetSex))) revert RequirementNotMet();
            }

            // 7. Register identity in global registry (or verify wallet matches)
            registry.registerOrVerify(identityCommitment, walletAddress);

            // 8. Store verification result and emit event
            verified[walletAddress] = true;
            emit ClaimVerified(identityCommitment, walletAddress, verifierAddress, timestamp);

        } catch {
            revert InvalidProof();
        }
    }

    function isVerified(address wallet) external view returns (bool) {
        return verified[wallet];
    }
}
