import os
import json
import subprocess
import threading
import time
import uuid
import tempfile
import socket
import http.client
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

app = Flask(__name__)
CORS(app)

APP_VERIFIER_ABI = [
    {"inputs": [], "name": "requireAge",          "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "minAge",              "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "requireNationality",  "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "targetNationality",   "outputs": [{"type": "string"}],  "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "requireSex",          "outputs": [{"type": "bool"}],    "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "targetSex",           "outputs": [{"type": "string"}],  "stateMutability": "view", "type": "function"},
]

EVM_BINARY = os.getenv("EVM_BINARY", "/usr/local/bin/evm")
PROOF_DIR   = os.getenv("PROOF_DIR", "/tmp/proofs")
os.makedirs(PROOF_DIR, exist_ok=True)

_proof_jobs: dict = {}
_proof_jobs_lock = threading.Lock()
_JOB_TTL_SECONDS = 3 * 60 * 60


def _prune_expired_jobs():
    cutoff = time.monotonic() - _JOB_TTL_SECONDS
    with _proof_jobs_lock:
        expired = [jid for jid, job in _proof_jobs.items() if job.get("created_at", 0) < cutoff]
        for jid in expired:
            del _proof_jobs[jid]


def _update_job(job_id: str, data: dict):
    with _proof_jobs_lock:
        _proof_jobs[job_id].update(data)


def _run_proof_job(job_id: str, passport: dict, wallet_address: str, verifier_address: str):
    print(f"\n[job:{job_id}] Started")
    print(f"[job:{job_id}] Wallet:   {wallet_address}")
    print(f"[job:{job_id}] Verifier: {verifier_address}")

    rpc_url = os.getenv("SEPOLIA_RPC_URL")
    if not rpc_url:
        _update_job(job_id, {"status": "error", "error": "SEPOLIA_RPC_URL not configured"})
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
        _update_job(job_id, {"status": "error", "error": f"Failed to read contract requirements: {e}"})
        return

    reqs = {
        "walletAddress":      wallet_address,
        "verifierAddress":    verifier_address,
        "requiredAge":        required_age,
        "requiredNationality": required_nationality,
        "requiredSex":        required_sex,
    }

    # Write requirements to a per-job temp file so concurrent jobs don't collide
    reqs_fd, reqs_path = tempfile.mkstemp(suffix=f"_{job_id}.json", prefix="reqs_")
    with os.fdopen(reqs_fd, "w") as f:
        json.dump(reqs, f, indent=4)
    print(f"[job:{job_id}] Written requirements to {reqs_path}")

    passport_input = {
        "documentNumber": passport.get("documentNumber", ""),
        "birthYear":      passport.get("birthYear", 0),
        "birthMonth":     passport.get("birthMonth", 0),
        "birthDay":       passport.get("birthDay", 0),
        "expiryYear":     passport.get("expiryYear", 0),
        "expiryMonth":    passport.get("expiryMonth", 0),
        "expiryDay":      passport.get("expiryDay", 0),
        "nationality":    passport.get("nationality", ""),
        "name":           passport.get("name", ""),
        "sex":            passport.get("sex", ""),
    }
    print(f"[job:{job_id}] Passport input: {passport_input}")

    env = os.environ.copy()
    env["PROOF_JOB_ID"]                   = job_id
    env["VERIFICATION_REQUIREMENTS_PATH"] = reqs_path
    env["PROOF_DIR"]                      = PROOF_DIR
    env.setdefault("RUST_LOG", "info")
    print(f"[job:{job_id}] SP1_PROVER: {env.get('SP1_PROVER', 'not set')}")
    print(f"[job:{job_id}] RUST_LOG: {env.get('RUST_LOG')}")
    print(f"[job:{job_id}] Running evm binary...", flush=True)

    stderr_lines: list = []

    def _pipe_stream(stream, label: str, collected: list):
        for raw in stream:
            line = raw.rstrip(b"\n").decode("utf-8", errors="replace")
            print(f"[job:{job_id}][{label}] {line}", flush=True)
            collected.append(line)

    try:
        proc = subprocess.Popen(
            [EVM_BINARY],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        proc.stdin.write(json.dumps(passport_input).encode())
        proc.stdin.close()

        t_out = threading.Thread(target=_pipe_stream, args=(proc.stdout, "stdout", []))
        t_err = threading.Thread(target=_pipe_stream, args=(proc.stderr, "stderr", stderr_lines))
        t_out.start()
        t_err.start()

        proc.wait(timeout=7200)
        t_out.join()
        t_err.join()
        returncode = proc.returncode
        print(f"[job:{job_id}] exited with code: {returncode}", flush=True)
    except subprocess.TimeoutExpired:
        proc.kill()
        t_out.join()
        t_err.join()
        _update_job(job_id, {"status": "error", "error": "Proof generation timed out after 2 hours"})
        return
    finally:
        try:
            os.unlink(reqs_path)
        except OSError:
            pass

    if returncode != 0:
        _update_job(job_id, {"status": "error", "error": "Proof generation failed", "stderr": "\n".join(stderr_lines[-20:])})
        return

    proof_path = os.path.join(PROOF_DIR, f"passport_proof_evm_{job_id}.json")
    if not os.path.exists(proof_path):
        _update_job(job_id, {"status": "error", "error": "Proof file not generated"})
        return

    with open(proof_path) as f:
        proof_data = json.load(f)

    try:
        os.unlink(proof_path)
    except OSError:
        pass

    print(f"[job:{job_id}] Done!")
    print(f"[job:{job_id}] proof:        {proof_data.get('proof', '')}")
    print(f"[job:{job_id}] publicValues: {proof_data.get('publicValues', '')}")
    print(f"[job:{job_id}] vkey:         {proof_data.get('vkey', '')}")
    _update_job(job_id, {
        "status":       "done",
        "proof":        proof_data.get("proof", ""),
        "publicValues": proof_data.get("publicValues", ""),
        "vkey":         proof_data.get("vkey", ""),
    })


class _UnixSocketHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path):
        super().__init__("localhost")
        self._socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self._socket_path)


def _tappd_quote(report_data: str = "") -> dict:
    socket_path = os.getenv("TAPPD_SOCKET", "/var/run/tappd.sock")
    conn = _UnixSocketHTTPConnection(socket_path)
    body = json.dumps({"report_data": report_data, "hash_algorithm": "sha256"})
    conn.request("POST", "/prpc/Tappd.TdxQuote", body=body,
                 headers={"Content-Type": "application/json"})
    resp = conn.getresponse()
    return json.loads(resp.read())


@app.route("/attestation", methods=["GET"])
def attestation():
    socket_path = os.getenv("TAPPD_SOCKET", "/var/run/tappd.sock")
    if not os.path.exists(socket_path):
        return jsonify({"error": "TEE attestation not available outside Phala enclave"}), 503
    try:
        data = _tappd_quote()
        return jsonify({
            "status": "ok",
            "quote": data.get("quote", ""),
            "event_log": data.get("event_log", ""),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get attestation: {e}"}), 500


@app.route("/health", methods=["GET"])
def health():
    binary_ok = os.path.isfile(EVM_BINARY) and os.access(EVM_BINARY, os.X_OK)
    return jsonify({"status": "healthy" if binary_ok else "degraded", "evm_binary": EVM_BINARY, "binary_found": binary_ok})


@app.route("/generate-proof", methods=["POST"])
def generate_proof():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    passport        = body.get("passport")
    wallet_address  = body.get("walletAddress")
    verifier_address = body.get("verifierAddress")

    if not passport or not wallet_address or not verifier_address:
        return jsonify({"error": "passport, walletAddress, and verifierAddress are required"}), 400

    _prune_expired_jobs()

    job_id = str(uuid.uuid4())
    with _proof_jobs_lock:
        _proof_jobs[job_id] = {"status": "pending", "created_at": time.monotonic()}

    threading.Thread(
        target=_run_proof_job,
        args=(job_id, passport, wallet_address, verifier_address),
        daemon=True,
    ).start()

    print(f"\n[generate-proof] Started job {job_id}")
    return jsonify({"jobId": job_id, "status": "pending"})


@app.route("/proof-status/<job_id>", methods=["GET"])
def proof_status(job_id):
    with _proof_jobs_lock:
        job = _proof_jobs.get(job_id)
        if job and job.get("status") in ("done", "error"):
            del _proof_jobs[job_id]
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({k: v for k, v in job.items() if k != "created_at"})


if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 8080))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print(f"ZKP service starting on port {port}")
    print(f"EVM binary: {EVM_BINARY} ({'found' if os.path.isfile(EVM_BINARY) else 'NOT FOUND'})")
    app.run(host="0.0.0.0", port=port, debug=debug)
