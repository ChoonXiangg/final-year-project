import { ethers } from "hardhat";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// SP1 Verifier addresses (from SP1 docs)
// See: https://docs.succinct.xyz/docs/sp1/verification/onchain/contract-addresses
const SP1_VERIFIER_SEPOLIA = "0x3B6041173B80E77f038f3F2C0f9744f04837185e"; // SP1VerifierGroth16

async function main() {
    console.log("Starting on-chain verification...");

    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log(`Network: ${network.name} (chainId: ${chainId})`);

    // 1. Get Verification Key
    console.log("Extracting VKey...");
    let vkey = "";
    try {
        const output = execSync("cargo run --release --bin vkey", { cwd: process.cwd() }).toString();
        const match = output.match(/VKey Hash: (0x[a-fA-F0-9]+)/) || output.match(/VKey Hash: ([a-fA-F0-9]+)/);
        if (match) {
            vkey = match[1];
            if (!vkey.startsWith("0x")) vkey = "0x" + vkey;
            console.log("VKey found:", vkey);
        } else {
            throw new Error("Could not find VKey Hash in output");
        }
    } catch (error) {
        console.error("Failed to get VKey:", error);
        process.exit(1);
    }

    // 2. Determine SP1 Verifier address based on network
    let sp1VerifierAddress: string;
    if (chainId === 31337) {
        // Local Hardhat network - deploy MockSP1Verifier
        console.log("Local network detected. Deploying MockSP1Verifier...");
        const MockSP1Verifier = await ethers.getContractFactory("MockSP1Verifier");
        const mockVerifier = await MockSP1Verifier.deploy();
        await mockVerifier.waitForDeployment();
        sp1VerifierAddress = await mockVerifier.getAddress();
        console.log("MockSP1Verifier deployed to:", sp1VerifierAddress);
    } else if (chainId === 11155111) {
        // Sepolia - use real SP1 Verifier
        sp1VerifierAddress = SP1_VERIFIER_SEPOLIA;
        console.log("Sepolia network detected. Using real SP1 Verifier:", sp1VerifierAddress);
    } else {
        throw new Error(`Unsupported network: ${chainId}. Add SP1 Verifier address for this network.`);
    }

    // 3. Deploy PassportVerifier
    console.log("Deploying PassportVerifier...");
    const PassportVerifier = await ethers.getContractFactory("PassportVerifier");
    const passportVerifier = await PassportVerifier.deploy(sp1VerifierAddress, vkey);
    await passportVerifier.waitForDeployment();
    const passportVerifierAddress = await passportVerifier.getAddress();
    console.log("PassportVerifier deployed to:", passportVerifierAddress);

    // 4. Read proofs
    const readProof = (filename: string) => {
        const filepath = path.join(process.cwd(), "proofs", filename);
        if (filename.endsWith(".json")) {
            const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
            return {
                publicValues: "0x" + data.publicValues,
                proofBytes: "0x" + data.proof
            };
        } else if (filename.endsWith(".bin")) {
            // For Groth16 proofs saved as binary
            const proofBytes = fs.readFileSync(filepath);
            // Note: For binary proofs, you need the public values separately
            // This is a limitation - the Groth16 prover should save both
            return {
                publicValues: "0x", // TODO: Read from separate file
                proofBytes: "0x" + proofBytes.toString("hex")
            };
        }
        throw new Error(`Unknown proof file format: ${filename}`);
    };

    // 5. Verify Age Proof
    console.log("\n--- Verifying Age Proof ---");
    try {
        const { publicValues, proofBytes } = readProof("age_proof.json");

        const tx = await passportVerifier.submitAgeProof(publicValues, proofBytes);
        const receipt = await tx.wait();
        console.log("Age Proof submitted successfully!");

        const event = receipt?.logs.find((log: any) => {
            try {
                return passportVerifier.interface.parseLog(log)?.name === "AgeVerified";
            } catch { return false; }
        });

        if (event) {
            const parsedLog = passportVerifier.interface.parseLog(event);
            console.log("AgeVerified Event Emitted:");
            console.log("  Identity Commitment:", parsedLog?.args[0]);
            console.log("  Is Over Age:", parsedLog?.args[1]);
            console.log("  Min Age:", parsedLog?.args[2]);
        }
    } catch (error) {
        console.error("Age Proof Verification Failed:", error);
    }

    // 6. Verify Nationality Proof
    console.log("\n--- Verifying Nationality Proof ---");
    try {
        let { publicValues, proofBytes } = readProof("nationality_proof.json");

        // Fix for alloy-sol-types adding a leading offset for dynamic structs
        if (publicValues.startsWith("0x0000000000000000000000000000000000000000000000000000000000000020")) {
            publicValues = "0x" + publicValues.slice(66);
        }

        const tx = await passportVerifier.submitNationalityProof(publicValues, proofBytes);
        const receipt = await tx.wait();
        console.log("Nationality Proof submitted successfully!");

        const event = receipt?.logs.find((log: any) => {
            try {
                return passportVerifier.interface.parseLog(log)?.name === "NationalityVerified";
            } catch { return false; }
        });

        if (event) {
            const parsedLog = passportVerifier.interface.parseLog(event);
            console.log("NationalityVerified Event Emitted:");
            console.log("  Identity Commitment:", parsedLog?.args[0]);
            console.log("  Nationality:", parsedLog?.args[1]);
        }
    } catch (error) {
        console.error("Nationality Proof Verification Failed:", error);
    }

    // 7. Verify Wallet Binding Proof
    console.log("\n--- Verifying Wallet Binding Proof ---");
    try {
        const { publicValues, proofBytes } = readProof("wallet_proof.json");

        const tx = await passportVerifier.submitWalletBindingProof(publicValues, proofBytes);
        const receipt = await tx.wait();
        console.log("Wallet Binding Proof submitted successfully!");

        const event = receipt?.logs.find((log: any) => {
            try {
                return passportVerifier.interface.parseLog(log)?.name === "WalletBound";
            } catch { return false; }
        });

        if (event) {
            const parsedLog = passportVerifier.interface.parseLog(event);
            console.log("WalletBound Event Emitted:");
            console.log("  Identity Commitment:", parsedLog?.args[0]);
            console.log("  Wallet Address:", parsedLog?.args[1]);
        }
    } catch (error) {
        console.error("Wallet Binding Proof Verification Failed:", error);
    }

    console.log("\nOn-chain verification complete!");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
