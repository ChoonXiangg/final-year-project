import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Input file paths
const PASSPORT_PATH = path.join(process.cwd(), 'mock_passport.json');
const REQUIREMENTS_PATH = path.join(process.cwd(), 'verification_requirements.json');
const PROOFS_DIR = path.join(process.cwd(), 'proofs');

// Ensure proofs directory exists
if (!fs.existsSync(PROOFS_DIR)) {
    fs.mkdirSync(PROOFS_DIR);
}

// Read inputs
const passport = JSON.parse(fs.readFileSync(PASSPORT_PATH, 'utf8'));
const requirements = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));

function runCommand(command: string) {
    console.log(`Running: ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        process.exit(1);
    }
}

async function main() {
    console.log("=== PASSPORT DATA ===");
    console.log(`Document Number: ${passport.documentNumber}`);
    console.log(`Name: ${passport.givenNames} ${passport.surname}`);
    console.log(`Birth Date: ${passport.birthYear}-${passport.birthMonth}-${passport.birthDay}`);
    console.log(`Expiry Date: ${passport.expiryYear}-${passport.expiryMonth}-${passport.expiryDay}`);
    console.log(`Nationality: ${passport.nationality}`);
    console.log();
    console.log("=== VERIFICATION REQUIREMENTS ===");
    console.log(`Wallet Address: ${requirements.walletAddress}`);
    console.log(`Required Age: ${requirements.requiredAge}`);
    console.log(`Required Nationality: ${requirements.requiredNationality}`);
    console.log();

    // Common passport args
    const passportArgs = [
        `--document-number ${passport.documentNumber}`,
        `--birth-year ${passport.birthYear}`,
        `--birth-month ${passport.birthMonth}`,
        `--birth-day ${passport.birthDay}`,
        `--nationality ${passport.nationality}`,
        `--given-names ${passport.givenNames}`,
        `--surname ${passport.surname}`,
        `--expiry-year ${passport.expiryYear}`,
        `--expiry-month ${passport.expiryMonth}`,
        `--expiry-day ${passport.expiryDay}`
    ].join(' ');

    // Passport args without expiry (for provers that don't need it)
    const passportArgsNoExpiry = [
        `--document-number ${passport.documentNumber}`,
        `--birth-year ${passport.birthYear}`,
        `--birth-month ${passport.birthMonth}`,
        `--birth-day ${passport.birthDay}`,
        `--nationality ${passport.nationality}`,
        `--given-names ${passport.givenNames}`,
        `--surname ${passport.surname}`
    ].join(' ');

    // 1. Generate Age Proof (Groth16)
    console.log("\n--- Generating Age Proof (Groth16) ---");
    runCommand(`cargo run --release --bin age-evm -- ${passportArgs} --min-age ${requirements.requiredAge} --output proofs/age_proof.bin`);

    // 2. Generate Nationality Proof (Groth16)
    console.log("\n--- Generating Nationality Proof (Groth16) ---");
    runCommand(`cargo run --release --bin nationality-evm -- ${passportArgs} --target-nationality ${requirements.requiredNationality} --output proofs/nationality_proof.bin`);

    // 3. Generate Wallet Binding Proof (Groth16)
    console.log("\n--- Generating Wallet Binding Proof (Groth16) ---");
    runCommand(`cargo run --release --bin wallet-evm -- ${passportArgs} --wallet-address ${requirements.walletAddress} --output proofs/wallet_proof.bin`);

    console.log("\n=== ALL PROOFS GENERATED SUCCESSFULLY ===");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
