// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassportRegistry.sol";
import "./AppVerifier.sol";

/// @title Verifier Factory
/// @notice Deploys AppVerifier instances and auto-registers them in PassportRegistry.
contract VerifierFactory {
    PassportRegistry public immutable registry;

    mapping(address => address[]) private _verifiersByOwner;

    event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex);

    constructor(address _registry) {
        registry = PassportRegistry(_registry);
    }

    function getVerifiers(address owner) external view returns (address[] memory) {
        return _verifiersByOwner[owner];
    }

    function createVerifier(
        address _sp1Verifier,
        bytes32 _passportVKey,
        bool _requireAge,
        uint256 _minAge,
        bool _requireNationality,
        string calldata _targetNationality,
        bool _requireSex,
        string calldata _targetSex
    ) external returns (address) {
        AppVerifier verifier = new AppVerifier(
            address(registry),
            _sp1Verifier,
            _passportVKey,
            _requireAge,
            _minAge,
            _requireNationality,
            _targetNationality,
            _requireSex,
            _targetSex
        );

        registry.addVerifier(address(verifier));

        _verifiersByOwner[msg.sender].push(address(verifier));

        emit VerifierCreated(address(verifier), msg.sender, _requireAge, _minAge, _requireNationality, _targetNationality, _requireSex, _targetSex);

        return address(verifier);
    }
}
