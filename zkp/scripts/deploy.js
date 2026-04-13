const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Passport Protocol contracts to Sepolia...\n");

  const SP1_VERIFIER_SEPOLIA = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

  // Read vkey from proof file, or fall back to vkey_hash.txt
  let passportVKey;
  const proofPath = path.join(__dirname, "../proofs/passport_proof_evm.json");
  const vkeyHashPath = path.join(__dirname, "../script/vkey_hash.txt");
  if (fs.existsSync(proofPath)) {
    const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    passportVKey = proofData.vkey;
  } else if (fs.existsSync(vkeyHashPath)) {
    passportVKey = fs.readFileSync(vkeyHashPath, "utf8").trim();
  } else {
    console.error("No vkey source found. Run `cargo run --release --bin vkey` in zkp/script first.");
    process.exit(1);
  }
  console.log("Passport VKey:", passportVKey);

  // 1. Deploy PassportRegistry
  console.log("\n1. Deploying PassportRegistry...");
  const PassportRegistry = await hre.ethers.getContractFactory("PassportRegistry");
  const registry = await PassportRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   PassportRegistry deployed to:", registryAddress);

  // 2. Deploy VerifierFactory
  console.log("\n2. Deploying VerifierFactory...");
  const VerifierFactory = await hre.ethers.getContractFactory("VerifierFactory");
  const factory = await VerifierFactory.deploy(registryAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   VerifierFactory deployed to:", factoryAddress);

  // 3. Authorize the factory in the registry
  console.log("\n3. Authorizing factory in registry...");
  const tx = await registry.setFactory(factoryAddress);
  await tx.wait();
  console.log("   Factory authorized");

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("PassportRegistry:", registryAddress);
  console.log("VerifierFactory :", factoryAddress);
  console.log("SP1 Verifier    :", SP1_VERIFIER_SEPOLIA);
  console.log("Passport VKey   :", passportVKey);
  console.log("\nApps can now call VerifierFactory.createVerifier() to deploy their own AppVerifier.");

  // Save addresses to deployment.json
  const deployment = {
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    PassportRegistry: registryAddress,
    VerifierFactory: factoryAddress,
    SP1Verifier: SP1_VERIFIER_SEPOLIA,
    passportVKey,
  };
  const deploymentPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\nAddresses saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
