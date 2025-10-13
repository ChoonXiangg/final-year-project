pragma solidity ^0.8.20;

contract TestVerifier {
    event ProofVerified(address indexed user, uint256 timestamp);
    
    function verifyTest() public returns (bool) {
        emit ProofVerified(msg.sender, block.timestamp);
        return true;
    }
}