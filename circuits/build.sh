#!/bin/bash
CIRCUIT_NAME=$1

echo "Building circuit: $CIRCUIT_NAME"

# Compile
circom ${CIRCUIT_NAME}.circom --r1cs --wasm --sym -o build

# Generate zkey (using existing ptau)
snarkjs groth16 setup build/${CIRCUIT_NAME}.r1cs pot12_final.ptau build/${CIRCUIT_NAME}_0000.zkey

# Export verification key
snarkjs zkey export verificationkey build/${CIRCUIT_NAME}_0000.zkey build/${CIRCUIT_NAME}_verification_key.json

# Export Solidity verifier
snarkjs zkey export solidityverifier build/${CIRCUIT_NAME}_0000.zkey ../contracts/${CIRCUIT_NAME}Verifier.sol

echo "Circuit built successfully!"