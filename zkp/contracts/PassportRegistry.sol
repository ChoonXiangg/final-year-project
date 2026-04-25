// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Passport Registry
/// @notice Global registry binding identity commitments to wallets. No personal data stored.
contract PassportRegistry {
    address public owner;

    mapping(bytes32 => address) public commitments;
    mapping(address => bool) public authorizedVerifiers;

    event IdentityRegistered(bytes32 indexed commitment, address indexed wallet);

    error NotOwner();
    error NotAuthorizedVerifier();
    error AlreadyRegistered();
    error WalletMismatch();

    address public factory;

    error NotOwnerOrFactory();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrFactory() {
        if (msg.sender != owner && msg.sender != factory) revert NotOwnerOrFactory();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function addVerifier(address verifier) external onlyOwnerOrFactory {
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
            commitments[commitment] = wallet;
            emit IdentityRegistered(commitment, wallet);
        } else if (existing != wallet) {
            revert WalletMismatch();
        }
    }

    function getWallet(bytes32 commitment) external view returns (address) {
        return commitments[commitment];
    }

    function isRegistered(bytes32 commitment) external view returns (bool) {
        return commitments[commitment] != address(0);
    }
}
