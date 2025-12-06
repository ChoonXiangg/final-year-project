const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function main() {
  console.log("Deploying PassportVerifier contract...\n");

  const SP1_VERIFIER_SEPOLIA = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

  // Check for vkey_hash.txt
  const vkeyPath = path.join(__dirname, "../script/vkey_hash.txt");
  if (!fs.existsSync(vkeyPath)) {
    console.log("vkey_hash.txt not found, running export_vkey script...");
    try {
      execSync("cd script && cargo run --release --bin vkey", { stdio: 'inherit', cwd: path.join(__dirname, "..") });
    } catch (e) {
      console.error("Failed to generate vkey!");
      process.exit(1);
    }
  }

  const passportVKey = fs.readFileSync(vkeyPath, "utf8").trim();
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
