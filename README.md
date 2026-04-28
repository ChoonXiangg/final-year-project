# ZK Identity Prover

A zero-knowledge identity verification system that lets users prove passport attributes — age, nationality, sex — to applications without revealing their passport or storing any personal data on-chain.

Users scan their passport on the mobile app, generate a cryptographic proof inside a Trusted Execution Environment (Phala TDX), and submit it to a smart contract on Ethereum Sepolia. The smart contract verifies the proof and registers the identity — no personal data ever leaves the user's device in plaintext.

---

## Architecture

```
Mobile App (React Native)
    │
    ├─ POST /ocr/passport ──────────────▶ OCR Service (Flask)
    │   [passport image]                      │
    │                                    Google Cloud Vision API
    │   ◀── [structured passport data] ───────┘
    │
    ├─ POST /generate-proof ────────────▶ OCR Service (proxy)
    │                                         │
    │                                    ZKP Service (Phala TEE)
    │                                         │
    │                                    Read AppVerifier requirements
    │                                    from Sepolia
    │                                         │
    │                                    SP1 Groth16 proof generation
    │                                    (inside TDX enclave)
    │   ◀── [proof, publicValues, vkey] ───────┘
    │
    └─ Submit proof ────────────────────▶ AppVerifier.verifyClaim()
                                              │
                                         PassportRegistry.registerOrVerify()
                                              │
                                         ClaimVerified event emitted

Web Dashboard (React)
    └─ Deploy AppVerifier via VerifierFactory (Sepolia)
```

---

## Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `ocr/` | Python / Flask | 5001 | Extract passport data from images via Google Cloud Vision |
| `zkp/` | Python / Flask + Rust | 8080 | Generate SP1 ZK proofs inside a Phala TDX enclave |
| `web/` | React / TypeScript | 3000 | Web dashboard for deploying verifier contracts |
| `app/` | React Native / Expo | — | Mobile app for end users |

---

## Smart Contracts (Ethereum Sepolia)

| Contract | Address |
|----------|---------|
| VerifierFactory | `0x7F58017ADd6CBA1cC1378A9215a3390552ab49Ce` |
| SP1Verifier | `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B` |

The `VerifierFactory` deploys `AppVerifier` instances. Each `AppVerifier` stores one application's requirements (minimum age, required nationality, required sex) and verifies SP1 Groth16 proofs against them. Verified identities are registered in `PassportRegistry`, which binds each identity commitment to a single wallet address to prevent Sybil attacks.

---

## Prerequisites

- Node.js 18+
- Python 3.12+
- Rust (for building the ZKP binary locally)
- Go 1.22+ (required by SP1's gnark FFI for Groth16)
- Expo CLI (`npm install -g expo-cli`)
- A Google Cloud project with Vision API enabled
- An Alchemy or Infura Sepolia RPC URL
- A WalletConnect project ID

---

## OCR Service

### Setup

```bash
cd ocr
pip install -r requirements.txt
```

Place your Google Cloud service account JSON at `ocr/credentials.json`.

### Environment

Create `ocr/.env`:

```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
FLASK_PORT=5001
FLASK_DEBUG=true
ZKP_SERVICE_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:3000
```

### Run

```bash
python app.py
```

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service status and credential validation |
| POST | `/ocr` | Extract raw text from any image |
| POST | `/ocr/passport` | Extract structured passport data (MRZ parsing) |
| POST | `/generate-proof` | Proxy to ZKP service |
| GET | `/proof-status/<job_id>` | Poll proof generation status |
| GET | `/attestation` | Proxy TEE attestation from ZKP service |

**POST /ocr/passport** accepts either:
- JSON: `{ "image": "<base64>" }`
- Multipart form: `image` file field

Supports JPEG, PNG, WebP, and HEIC (iPhone photos).

### Tests

```bash
pytest test_app.py -v
```

---

## ZKP Service

### Setup

```bash
cd zkp
pip install -r requirements.txt
```

Build the Rust proof generation binary (requires Rust, Go, and the SP1 toolchain):

```bash
cd script
cargo build --release --bin evm
```

### Environment

Create `zkp/.env`:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
SP1_PROVER=cpu
FLASK_PORT=8080
FLASK_DEBUG=false
EVM_BINARY=./target/release/evm
PROOF_DIR=/tmp/proofs
```

`SP1_PROVER` options:
- `mock` — instant, no real proof, for testing only
- `cpu` — real Groth16 proof on local CPU (~30 min, requires 16 GB+ RAM)
- `network` — delegates to [Succinct Prover Network](https://docs.succinct.xyz) (recommended for production)

### Run

```bash
python app.py
```

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check if EVM binary is available |
| POST | `/generate-proof` | Start async proof generation |
| GET | `/proof-status/<job_id>` | Poll proof status |
| GET | `/attestation` | Get Phala TDX attestation quote |

**POST /generate-proof** body:
```json
{
  "passport": {
    "documentNumber": "A1234567",
    "birthYear": 1990,
    "birthMonth": 1,
    "birthDay": 1,
    "expiryYear": 2030,
    "expiryMonth": 1,
    "expiryDay": 1,
    "nationality": "MYS",
    "name": "JOHN DOE",
    "sex": "M"
  },
  "walletAddress": "0x...",
  "verifierAddress": "0x..."
}
```

Returns `{ "jobId": "...", "status": "pending" }`. Poll `/proof-status/<jobId>` until `status` is `done` or `error`.

### Docker Deployment (Phala TEE)

The Dockerfile builds a Linux/amd64 image suitable for Phala's TDX enclave:

```bash
docker buildx build --platform linux/amd64 -t <registry>/<image>:latest --push .
```

The TEE attestation endpoint (`/attestation`) only works when running inside a genuine Phala enclave. It returns an Intel-signed TDX quote that proves the service is unmodified.

### Tests

```bash
pytest test_app.py -v
```

### Hardhat Contract Tests

```bash
npm install
npx hardhat test
npx hardhat run scripts/test-local.js --network localhost
```

---

## Web Dashboard

### Setup

```bash
cd web
npm install
```

### Environment

Create `web/.env`:

```env
REACT_APP_ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
REACT_APP_OCR_API_URL=http://localhost:5001
```

### Run

```bash
npm start
```

### Features

- **Deploy** — Select verification requirements (age, nationality, sex) and deploy a custom `AppVerifier` contract to Sepolia
- **View** — Browse verifier contracts deployed by any wallet address, with QR code generation for the mobile app
- **Verify** — Look up whether a wallet address has been verified by a specific contract, and inspect the proof details
- **TEE** — Fetch and display the Phala TDX attestation quote from the ZKP service

### Tests

```bash
npm test
```

---

## Mobile App

### Setup

```bash
cd app
npm install
```

### Environment

Create `app/.env`:

```env
EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-project-id>
EXPO_PUBLIC_OCR_API_URL=http://<your-local-ip>:5001
EXPO_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
```

Use your machine's local IP address (not `localhost`) so the physical device can reach the OCR service.

### Run

```bash
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator or device
```

### User Flow

1. Connect wallet via WalletConnect (MetaMask or any compatible wallet)
2. Enter an `AppVerifier` contract address or scan its QR code from the web dashboard
3. Photograph your passport with the in-app camera
4. Review the extracted passport data
5. Tap **Generate Proof** — the OCR service forwards the request to the ZKP service in the TEE; proof generation takes several minutes
6. Once the proof is ready, tap **Submit On-Chain** — MetaMask opens to sign the transaction
7. The proof is verified on Sepolia and your identity is registered

### Tests

```bash
npx jest
```

---

## How It Works

### Zero-Knowledge Proof

The SP1 zkVM executes the ZK circuit (`zkp/program/src/main.rs`) with the passport data as private inputs. The circuit:

1. Checks the passport has not expired
2. Computes an `identityHash` from the passport fields using SHA-256 (this is the on-chain identity commitment — no raw data is stored)
3. Checks age, nationality, and sex against the application's requirements
4. ABI-encodes the results as public outputs (`publicValues`)

SP1 generates a Groth16 proof that this computation ran correctly. The proof can be verified by any Solidity contract using the SP1 verifier on Sepolia, without the verifier ever seeing the passport data.

### Trusted Execution Environment

The ZKP service runs inside a Phala TDX enclave. The TEE provides two guarantees:

- **Confidentiality** — passport data is processed in isolated hardware memory that cannot be read by the host or infrastructure provider
- **Integrity** — the code running inside the enclave is exactly the published Docker image and cannot be modified at runtime

The `/attestation` endpoint returns an Intel-signed TDX quote that any third party can verify against Intel's DCAP service.

### Sybil Resistance

The `PassportRegistry` contract binds each identity commitment to the first wallet address that submits a valid proof for it. If a second wallet attempts to verify using the same passport, the transaction reverts with `WalletMismatch`. This prevents one person from verifying multiple wallets.

---

## Project Structure

```
final-year-project/
├── ocr/
│   ├── app.py                  # Flask routes
│   ├── google_ocr.py           # MRZ parsing & image preprocessing
│   ├── vision_client.py        # Google Cloud Vision API client
│   ├── test_app.py             # pytest tests
│   └── requirements.txt
│
├── zkp/
│   ├── app.py                  # Flask wrapper for proof generation
│   ├── program/src/main.rs     # ZK circuit (runs inside SP1 zkVM)
│   ├── lib/src/lib.rs          # Shared types and helper functions
│   ├── script/src/bin/evm.rs   # Rust binary: generates Groth16 proof
│   ├── contracts/
│   │   ├── AppVerifier.sol     # Per-app proof verifier
│   │   ├── PassportRegistry.sol# Global identity registry
│   │   ├── VerifierFactory.sol # Deploys AppVerifier instances
│   │   └── MockSP1Verifier.sol # Mock verifier for testing
│   ├── test_app.py             # pytest tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── web/
│   ├── src/
│   │   ├── App.tsx             # Deploy verifier contracts
│   │   ├── DeployedContracts.tsx
│   │   ├── Verify.tsx          # Look up proof submissions
│   │   ├── Attestation.tsx     # TEE attestation display
│   │   ├── Layout.tsx          # Shared layout & wallet button
│   │   └── WalletContext.tsx
│   └── src/App.test.tsx        # React Testing Library tests
│
└── app/
    ├── App.tsx                 # Main screen
    ├── components/
    │   ├── CameraModal.tsx     # Passport camera capture
    │   ├── PassportModal.tsx   # Show extracted data & proof status
    │   ├── QRScanModal.tsx     # Scan verifier contract QR
    │   └── WalletButton.tsx
    ├── hooks/useProofGeneration.ts
    ├── utils/proof.ts
    └── __tests__/
        └── useProofGeneration.test.ts
```
