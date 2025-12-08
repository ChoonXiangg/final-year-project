const fs = require("fs");
const path = require("path");
const ethers = require("ethers");

async function main() {
    const proofPath = path.join(__dirname, "../proofs/passport_proof_evm.json");
    const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    let publicValues = "0x" + proofData.publicValues.replace(/^0x/, "");

    // Detect 64-byte prefix issue (which happens when encoding vec<u8> sometimes includes length prefix if not careful, 
    // but SP1 usually returns raw bytes, however the 'bytes' type in Solidity expects a length prefix if using 'bytes calldata' 
    // wait, verifyProof takes 'bytes calldata publicValues'.

    // Actually, 'publicValues' argument to verifyProof is expected to be the raw bytes of the public values?
    // Or does it expect abi.encoded bytes?
    // The ABI of ISP1Verifier is: verifyProof(bytes32, bytes, bytes);
    // The 'bytes' argument in Solidity is length-prefixed. Ethers handles this if we pass a hex string.

    // However, the CONTENT of publicValues struct is what we are decoding.
    // Let's print what we have.

    console.log("Raw Public Values Hex:", publicValues);

    // Check length
    // 66 = 0x + 32 bytes (64 chars)?? No.
    // publicValues.length.

    console.log("Length (chars):", publicValues.length);

    // Try decoding directly first.
    const abiCoder = new ethers.AbiCoder();

    try {
        const decoded = abiCoder.decode(
            ["bool", "bool", "bool", "bytes32", "address", "uint256", "string", "uint256"],
            publicValues
        );
        printDecoded(decoded, "Direct Decode");
    } catch (e) {
        console.log("Direct decode failed:", e.shortMessage || e.message);

        // Try stripping first 32 bytes (common issue with SP1 output sometimes being wrapped or having a prepended offset)
        if (publicValues.length > 66) {
            const stripped = "0x" + publicValues.slice(66);
            try {
                const decoded = abiCoder.decode(
                    ["bool", "bool", "bool", "bytes32", "address", "uint256", "string", "uint256"],
                    stripped
                );
                printDecoded(decoded, "Stripped Prefix Decode");
            } catch (e2) {
                console.log("Stripped decode failed:", e2.shortMessage || e2.message);
            }
        }
    }
}

function printDecoded(decoded, label) {
    console.log(`\n--- ${label} ---`);
    console.log("isValidSig:", decoded[0]);
    console.log("isOverMinAge:", decoded[1]);
    console.log("isNationalityMatch:", decoded[2]);
    console.log("identityCommitment:", decoded[3]);
    console.log("walletAddress:", decoded[4]);
    console.log("minAge:", decoded[5]);
    console.log("targetNationality:", decoded[6]);
    console.log("timestamp:", decoded[7].toString());
}

main();
