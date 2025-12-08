const ethers = require("ethers");

const readline = require("readline");

async function main() {
    // 1. Get input from Args or Stdin
    let inputData = process.argv[2];

    if (!inputData) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        inputData = await new Promise(resolve => {
            rl.question("Please paste the Transaction Input Data (Hex): ", (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

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

    console.log("\nArgument 2: Proof Bytes (Truncated)");
    console.log(proofBytes.slice(0, 60) + "...");
    console.log("---------------------------------------------------\n");

    // 3. Decode the Public Values structure
    // The public values bytes themselves are encoded as a tuple:
    // (bool, bool, bool, bytes32, address, uint256, string, uint256)

    // Important: We need to handle the potential 32-byte prefix issue we saw earlier.
    // Although normally abi.decode on the *result* of previous decode should be clean.
    // The previous decode verified the outer ABI layer.

    let innerBytes = publicValuesBytes;

    // Try decoding
    try {
        // NOTE: Based on our previous debugging, the publicValues bytes coming from SP1 
        // might have an extra 32-byte prefix (length or offset) when fed into Solidity 
        // if not handled perfectly.
        // Ethers ABI decoder expects standard ABI encoding.

        // Let's inspect the first word of innerBytes to see if it's an offset (0x20 = 32)
        // or if it's the first boolean (0x0...01 or 0x0...00).

        const firstWord = innerBytes.slice(0, 66); // 0x + 64 chars
        console.log("First word of Public Values:", firstWord);

        // If the first word is 0x...20 (decimal 32), it generally means it's an offset to the start of the tuple 
        // OR a length prefix if it was just "bytes".

        // Let's try standard decoding first.
        const decodedValues = abiCoder.decode(
            ["bool", "bool", "bool", "bytes32", "address", "uint256", "string", "uint256"],
            innerBytes
        );
        printDecoded(decodedValues);

    } catch (e) {
        console.log("Standard decode failed. Trying to skip first 32 bytes prefix...");
        try {
            // Skip 32 bytes (64 hex chars)
            const slicedBytes = "0x" + innerBytes.slice(66);
            const decodedValues = abiCoder.decode(
                ["bool", "bool", "bool", "bytes32", "address", "uint256", "string", "uint256"],
                slicedBytes
            );
            printDecoded(decodedValues);
        } catch (e2) {
            console.error("Decoding failed again:", e2.message);
        }
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
