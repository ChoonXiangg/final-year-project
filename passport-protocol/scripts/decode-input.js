const ethers = require("ethers");

const readline = require("readline");

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const inputData = await new Promise(resolve => {
        rl.question("Please paste the Transaction Input Data (Hex): ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

    if (!inputData) {
        console.error("No input data provided.");
        process.exit(1);
    }

    console.log("Decoding Transaction Input Data...\n");

    const abiCoder = new ethers.AbiCoder();

    // 1. Identify Function Selector
    const selector = inputData.slice(0, 10); // 0x + 8 chars
    console.log("Function Selector:", selector);

    if (selector !== "0x6b3fc9d8") {
        console.log("Warning: Selector does not match verifyPassport(bytes,bytes)");
    }

    // 2. Decode the Function Arguments (bytes publicValues, bytes proofBytes)
    const argsData = "0x" + inputData.slice(10);

    // NOTE: 'bytes' in Solidity ABI is dynamic. The ABI decoding will handle the offsets.
    const decodedArgs = abiCoder.decode(["bytes", "bytes"], argsData);

    const publicValuesBytes = decodedArgs[0];
    const proofBytes = decodedArgs[1];

    console.log("\n---------------------------------------------------");
    console.log("Argument 1: Public Values (Raw Bytes)");
    console.log(publicValuesBytes);

    console.log("\nArgument 2: Proof Bytes");
    console.log(proofBytes);
    console.log("---------------------------------------------------\n");

    let innerBytes = publicValuesBytes;

    // Check for the 32-byte length/offset prefix (0x...20) common in SP1 outputs
    // 0x20 (32 decimal) is often the offset to the bytes content
    const firstWord = innerBytes.slice(0, 66); // 0x + 64 chars
    if (firstWord.endsWith("0000000000000000000000000000000000000000000000000000000000000020")) {
        innerBytes = "0x" + innerBytes.slice(66);
    }

    try {
        const decodedValues = abiCoder.decode(
            ["bool", "bool", "bool", "bytes32", "address", "uint256", "string", "uint256"],
            innerBytes
        );
        printDecoded(decodedValues);
    } catch (e) {
        console.error("Decoding failed:", e.message);
    }
}

function printDecoded(decoded) {
    console.log("✅ DECODED PUBLIC INPUTS:");
    console.log("-----------------------");
    console.log(`1. Signature Valid?      : ${decoded[0]} (bool)`);
    console.log(`2. Over Minimum Age?     : ${decoded[1]} (bool)`);
    console.log(`3. Nationality Matches?  : ${decoded[2]} (bool)`);
    console.log(`4. Identity Commitment   : ${decoded[3]} (bytes32)`);
    console.log(`5. Bound Wallet Address  : ${decoded[4]} (address)`);
    console.log(`6. Minimum Age Checked   : ${decoded[5]} (uint256)`);
    console.log(`7. Target Nationality    : "${decoded[6]}" (string)`);
    console.log(`8. Timestamp             : ${decoded[7]} (uint256) -> ${new Date(Number(decoded[7]) * 1000).toISOString()}`);
}

main();
