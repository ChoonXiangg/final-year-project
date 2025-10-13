async function main() {
  const TestVerifier = await ethers.getContractFactory("TestVerifier");
  const verifier = await TestVerifier.deploy();
  await verifier.waitForDeployment();
  
  console.log("TestVerifier deployed to:", await verifier.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});