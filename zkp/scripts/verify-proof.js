const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Using Signer:", signer.address);

    const proofPath = path.join(__dirname, "../proofs/passport_proof_evm.json");
    if (!fs.existsSync(proofPath)) {
        console.error("Proof file not found. It is expected at:", proofPath);
        process.exit(1);
    }

    const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    // Ensure we handle both with/without 0x prefix scenarios cleanly
    const proof = "0x" + proofData.proof.replace(/^0x/, "");
    const publicValues = "0x" + proofData.publicValues.replace(/^0x/, "");
    const vkey = proofData.vkey;

    console.log("Loaded proof for VKey:", vkey);

    // Address of the SP1 Verifier Gateway on Sepolia
    const SP1_VERIFIER_SEPOLIA = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    verifierAddress = await new Promise(resolve => {
        rl.question("Please enter the PassportVerifier Contract Address: ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

    if (!verifierAddress || !hre.ethers.isAddress(verifierAddress)) {
        console.error("❌ Invalid Contract Address provided.");
        process.exit(1);
    }

    console.log("\nAttaching to PassportVerifier at:", verifierAddress);
    const verifier = await hre.ethers.getContractAt("PassportVerifier", verifierAddress);

    console.log("\nVerifying proof on-chain (expecting success if proof is valid)...");
    try {
        const tx = await verifier.verifyPassport(publicValues, proof);
        console.log("Transaction submitted:", tx.hash);

        console.log("Waiting for confirmation...");
        await tx.wait();
        console.log("✅ Proof Verified Successfully on Sepolia!");

    } catch (error) {
        console.error("❌ Verification Failed:", error.message);
        if (error.data) {
            console.error("Error Data:", error.data);
            // Try decoding error if it's a known custom error
            try {
                const decodedError = verifier.interface.parseError(error.data);
                console.error("Decoded Error:", decodedError.name, decodedError.args);
            } catch (e) {
                console.log("Could not decode error data.");
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
