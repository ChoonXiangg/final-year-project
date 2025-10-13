import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@oasisprotocol/sapphire-hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28", settings: {
      optimizer: {
        enabled: true, runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY!]
    },
    sapphire_testnet: {
      url: "https://testnet.sapphire.oasis.io",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 0x5aff
    }
  }
};

export default config;
