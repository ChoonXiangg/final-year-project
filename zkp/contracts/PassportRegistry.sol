// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Passport Registry
/// @notice Global registry binding identity commitments to wallets. No personal data stored.
contract PassportRegistry {
    address public owner;

    // commitment => wallet
    mapping(bytes32 => address) public commitments;

    // Authorized verifier contracts that can register identities
    mapping(address => bool) public authorizedVerifiers;

    event IdentityRegistered(bytes32 indexed commitment, address indexed wallet);

    error NotOwner();
    error NotAuthorizedVerifier();
    error AlreadyRegistered();
    error WalletMismatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = true;
    }

    function removeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = false;
    }

    /// @notice Register or verify an identity commitment. Called by authorized verifiers only.
    /// @dev First call binds commitment to wallet. Subsequent calls check wallet matches.
    function registerOrVerify(bytes32 commitment, address wallet) external {
        if (!authorizedVerifiers[msg.sender]) revert NotAuthorizedVerifier();

        address existing = commitments[commitment];

        if (existing == address(0)) {
            // First registration — bind commitment to wallet
            commitments[commitment] = wallet;
            emit IdentityRegistered(commitment, wallet);
        } else if (existing != wallet) {
            // Already registered to a different wallet
            revert WalletMismatch();
        }
        // If existing == wallet, it's a re-verification — no-op
    }

    function getWallet(bytes32 commitment) external view returns (address) {
        return commitments[commitment];
    }

    function isRegistered(bytes32 commitment) external view returns (bool) {
        return commitments[commitment] != address(0);
    }
}
