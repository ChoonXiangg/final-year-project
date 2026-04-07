import os
import json
import subprocess
import base64
import threading
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from web3 import Web3

import google_ocr

load_dotenv()

app = Flask(__name__)
CORS(app)

# Minimal ABI for reading AppVerifier requirements
APP_VERIFIER_ABI = [
    {"inputs": [], "name": "requireAge",          "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "minAge",              "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "requireNationality",  "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "targetNationality",   "outputs": [{"type": "string"}],  "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "requireSex",          "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "targetSex",           "outputs": [{"type": "string"}],  "stateMutability": "view", "type": "function"},
]

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./credentials.json")
GOOGLE_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")

# In-memory store for the most recently scanned passport (ZK-proof subset of fields).
_latest_passport: dict | None = None


def _google_configured() -> tuple[bool, str]:
    """Validate credentials file structure. Returns (is_valid, message)."""
    return google_ocr.validate_credentials(GOOGLE_CREDENTIALS_PATH)


def _get_image_bytes(req) -> bytes:
    """
    Extract raw image bytes from the request.

    Accepts two formats:
      - JSON body:          {"image": "<base64-string>"}
      - Multipart upload:   form field named "image"

    Raises ValueError with a descriptive message on bad input.
    """
    if req.is_json:
        body = req.get_json(silent=True) or {}
        if "image" not in body:
            raise ValueError("Missing 'image' field in JSON body.")
        try:
            return base64.b64decode(body["image"])
        except Exception:
            raise ValueError("Invalid base64 data in 'image' field.")

    if "image" in req.files:
        return req.files["image"].read()

    raise ValueError(
        "No image provided. Send JSON {\"image\": \"<base64>\"} "
        "or a multipart form with an 'image' file field."
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    valid, message = _google_configured()
    return jsonify({
        "status": "healthy" if valid else "degraded",
        "google_configured": valid,
        "credentials_message": message,
        "credentials_file": GOOGLE_CREDENTIALS_PATH,
        "project_id": GOOGLE_PROJECT_ID,
    })


@app.route("/ocr", methods=["POST"])
def ocr():
    """
    Extract raw text from an image using Google Cloud Vision.

    Request (one of):
      JSON:      {"image": "<base64>"}
      Multipart: form field "image"

    Response:
      {"success": true,  "text": "...", "lines": ["...", ...]}
      {"success": false, "error": "..."}
    """
    try:
        image_bytes = _get_image_bytes(request)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    try:
        full_text, lines = google_ocr.extract_text_from_image(image_bytes)
        return jsonify({"success": True, "text": full_text, "lines": lines})
    except google_ocr.GoogleOCRError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.http_status


@app.route("/ocr/passport", methods=["POST"])
def ocr_passport():
    """
    Extract structured passport data from an image using Google Cloud Vision.

    Request (one of):
      JSON:      {"image": "<base64>"}
      Multipart: form field "image"

    Response (MRZ found):
      {
        "success": true,
        "text": "<raw OCR text>",
        "data": {
          "name": "...",
          "nationality": "...", "documentNumber": "...",
          "dateOfBirth": "YYMMDD", "dateOfExpiry": "YYMMDD",
          "sex": "M|F|unspecified", "age": <int>,
          "issuingCountry": "...", "personalNumber": "..."
        }
      }

    Response (MRZ not found — image unclear or not a passport):
      {"success": true, "text": "<raw OCR text>", "data": null}

    Response (error):
      {"success": false, "error": "..."}
    """
    try:
        image_bytes = _get_image_bytes(request)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    global _latest_passport
    try:
        passport_data, full_text, confidence = google_ocr.analyze_passport_image(image_bytes)
        if passport_data:
            _latest_passport = {
                "documentNumber": passport_data["documentNumber"],
                "birthYear":      passport_data["birthYear"],
                "birthMonth":     passport_data["birthMonth"],
                "birthDay":       passport_data["birthDay"],
                "expiryYear":     passport_data["expiryYear"],
                "expiryMonth":    passport_data["expiryMonth"],
                "expiryDay":      passport_data["expiryDay"],
                "nationality":    passport_data["nationality"],
                "name":           passport_data["name"],
            }
        return jsonify({"success": True, "text": full_text, "data": passport_data, "confidence": confidence})
    except google_ocr.GoogleOCRError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.http_status


@app.route("/passport", methods=["GET"])
def get_passport():
    """
    Return the most recently scanned passport data in the format expected by
    the ZK proof script.  Pipe this into the evm binary to generate a proof:

        curl -s http://localhost:5000/passport | cargo run --bin evm

    Response (scan available):
      {"documentNumber": "...", "birthYear": ..., ...}

    Response (no scan yet):
      404 {"success": false, "error": "No passport scanned yet."}
    """
    if _latest_passport is None:
        return jsonify({"success": False, "error": "No passport scanned yet."}), 404
    return jsonify(_latest_passport)


ZKP_DIR = os.path.join(os.path.dirname(__file__), "..", "zkp")
CARGO_BIN = os.path.expanduser("~/.cargo/bin/cargo")

# In-memory job store: { job_id: { status, proof, publicValues, vkey, error } }
_proof_jobs: dict = {}
_proof_jobs_lock = threading.Lock()


def _run_proof_job(job_id: str, passport: dict, wallet_address: str, verifier_address: str):
    """Run proof generation in a background thread and update _proof_jobs when done."""

    def update(data: dict):
        with _proof_jobs_lock:
            _proof_jobs[job_id].update(data)

    print(f"\n[job:{job_id}] Request received")
    print(f"[job:{job_id}] Wallet:   {wallet_address}")
    print(f"[job:{job_id}] Verifier: {verifier_address}")

    # Read requirements from the AppVerifier contract on Sepolia
    rpc_url = os.getenv("SEPOLIA_RPC_URL")
    if not rpc_url:
        update({"status": "error", "error": "SEPOLIA_RPC_URL not configured"})
        return
    print(f"[job:{job_id}] Reading contract requirements from Sepolia...")
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(verifier_address),
            abi=APP_VERIFIER_ABI,
        )
        require_age         = contract.functions.requireAge().call()
        require_nationality = contract.functions.requireNationality().call()
        require_sex         = contract.functions.requireSex().call()
        required_age         = int(contract.functions.minAge().call())       if require_age         else 0
        required_nationality = contract.functions.targetNationality().call() if require_nationality else ""
        required_sex         = contract.functions.targetSex().call()         if require_sex         else ""
        print(f"[job:{job_id}] Requirements: age={required_age}, nationality='{required_nationality}', sex='{required_sex}'")
    except Exception as e:
        print(f"[job:{job_id}] ERROR reading contract: {e}")
        update({"status": "error", "error": f"Failed to read contract requirements: {e}"})
        return

    # Write verification_requirements.json
    reqs = {
        "walletAddress": wallet_address,
        "verifierAddress": verifier_address,
        "requiredAge": required_age,
        "requiredNationality": required_nationality,
        "requiredSex": required_sex,
    }
    reqs_path = os.path.join(ZKP_DIR, "verification_requirements.json")
    with open(reqs_path, "w") as f:
        json.dump(reqs, f, indent=4)
    print(f"[job:{job_id}] Written verification_requirements.json")

    # Build passport JSON for stdin
    passport_input = {
        "documentNumber": passport.get("documentNumber", ""),
        "birthYear":  passport.get("birthYear", 0),
        "birthMonth": passport.get("birthMonth", 0),
        "birthDay":   passport.get("birthDay", 0),
        "expiryYear":  passport.get("expiryYear", 0),
        "expiryMonth": passport.get("expiryMonth", 0),
        "expiryDay":   passport.get("expiryDay", 0),
        "nationality": passport.get("nationality", ""),
        "name":        passport.get("name", ""),
        "sex":         passport.get("sex", ""),
    }
    print(f"[job:{job_id}] Passport input: {passport_input}")

    # Run cargo run --bin evm
    script_dir = os.path.join(ZKP_DIR, "script")
    env = os.environ.copy()
    env["PATH"] = os.path.expanduser("~/.cargo/bin") + ":" + os.path.expanduser("~/.sp1/bin") + ":" + env.get("PATH", "")
    wrapper = os.path.join(ZKP_DIR, "scripts", "sp1-rustc-wrapper.sh")
    if os.path.isfile(wrapper):
        os.chmod(wrapper, 0o755)
        env["RUSTC_WRAPPER"] = wrapper
    print(f"[job:{job_id}] SP1_PROVER: {env.get('SP1_PROVER', 'not set')}")
    print(f"[job:{job_id}] Running cargo (this may take a long time for cpu prover)...")

    try:
        result = subprocess.run(
            [CARGO_BIN, "run", "--release", "--bin", "evm"],
            input=json.dumps(passport_input),
            capture_output=True,
            text=True,
            cwd=script_dir,
            env=env,
            timeout=7200,  # 2-hour hard cap
        )
        print(f"[job:{job_id}] cargo exited with code: {result.returncode}")
        if result.stdout:
            print(f"[job:{job_id}] stdout:\n{result.stdout}")
        if result.stderr:
            print(f"[job:{job_id}] stderr:\n{result.stderr}")
    except subprocess.TimeoutExpired:
        print(f"[job:{job_id}] ERROR: timed out after 7200s")
        update({"status": "error", "error": "Proof generation timed out after 2 hours"})
        return

    if result.returncode != 0:
        update({"status": "error", "error": "Proof generation failed", "stderr": result.stderr[-500:]})
        return

    # Read generated proof
    proof_path = os.path.join(ZKP_DIR, "proofs", "passport_proof_evm.json")
    if not os.path.exists(proof_path):
        update({"status": "error", "error": "Proof file not generated"})
        return

    with open(proof_path) as f:
        proof_data = json.load(f)

    print(f"[job:{job_id}] Done!")
    update({
        "status": "done",
        "proof":        proof_data.get("proof", ""),
        "publicValues": proof_data.get("publicValues", ""),
        "vkey":         proof_data.get("vkey", ""),
    })


@app.route("/generate-proof", methods=["POST"])
def generate_proof():
    """
    Start async proof generation. Returns a job ID immediately.

    Request JSON:
      { "passport": {...}, "walletAddress": "0x...", "verifierAddress": "0x..." }

    Response:
      { "jobId": "<uuid>", "status": "pending" }
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    passport = body.get("passport")
    wallet_address = body.get("walletAddress")
    verifier_address = body.get("verifierAddress")

    if not passport or not wallet_address or not verifier_address:
        return jsonify({"error": "passport, walletAddress, and verifierAddress are required"}), 400

    job_id = str(uuid.uuid4())
    with _proof_jobs_lock:
        _proof_jobs[job_id] = {"status": "pending"}

    thread = threading.Thread(
        target=_run_proof_job,
        args=(job_id, passport, wallet_address, verifier_address),
        daemon=True,
    )
    thread.start()

    print(f"\n[generate-proof] Started job {job_id}")
    return jsonify({"jobId": job_id, "status": "pending"})


@app.route("/proof-status/<job_id>", methods=["GET"])
def proof_status(job_id):
    """
    Poll for proof generation status.

    Response (pending):  { "status": "pending" }
    Response (done):     { "status": "done", "proof": "...", "publicValues": "...", "vkey": "..." }
    Response (error):    { "status": "error", "error": "..." }
    """
    with _proof_jobs_lock:
        job = _proof_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    valid, message = _google_configured()
    if not valid:
        print(f"WARNING: {message}")
        print("See .env.example for setup instructions.")
    else:
        print(f"Google Cloud credentials OK ({GOOGLE_CREDENTIALS_PATH})")
        if GOOGLE_PROJECT_ID:
            print(f"Project ID: {GOOGLE_PROJECT_ID}")

    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
