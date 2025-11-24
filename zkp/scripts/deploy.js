const hre = require("hardhat");

async function main() {
  console.log("Deploying PassportRegistry contract...\n");

  // Get the contract factory
  const PassportRegistry = await hre.ethers.getContractFactory("PassportRegistry");

  // Deploy the contract
  const passportRegistry = await PassportRegistry.deploy();

  await passportRegistry.waitForDeployment();

  const address = await passportRegistry.getAddress();

  console.log("PassportRegistry deployed to:", address);
  console.log("\nContract details:");
  console.log("- SP1_VERIFIER:", await passportRegistry.SP1_VERIFIER());
  console.log("- PASSPORT_VKEY:", await passportRegistry.PASSPORT_VKEY());

  console.log("\nSave this address for testing!");
  console.log("\nYou can interact with the contract using:");
  console.log(`const registry = await ethers.getContractAt("PassportRegistry", "${address}");`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
