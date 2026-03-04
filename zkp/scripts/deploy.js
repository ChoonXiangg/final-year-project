const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function main() {
  console.log("Deploying PassportVerifier contract...\n");

  const SP1_VERIFIER_SEPOLIA = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

  // Read vkey from the existing proof file
  const proofPath = path.join(__dirname, "../proofs/passport_proof_evm.json");
  if (!fs.existsSync(proofPath)) {
    console.error("❌ proofs/passport_proof_evm.json not found!");
    console.error("Please refer to the README to generate a proof first.");
    process.exit(1);
  }

  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const passportVKey = proofData.vkey;
  console.log("Passport VKey:", passportVKey);

  // Get the contract factory
  const PassportVerifier = await hre.ethers.getContractFactory("PassportVerifier");

  // Deploy the contract
  const passportVerifier = await PassportVerifier.deploy(SP1_VERIFIER_SEPOLIA, passportVKey);

  await passportVerifier.waitForDeployment();

  const address = await passportVerifier.getAddress();

  console.log("PassportVerifier deployed to:", address);
  console.log("\nContract details:");
  console.log("- SP1_VERIFIER:", await passportVerifier.sp1Verifier());
  console.log("- PASSPORT_VKEY:", await passportVerifier.passportVKey());

  console.log("\nSave this address for interaction!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
