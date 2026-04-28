import os
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests as http

import google_ocr

load_dotenv()

app = Flask(__name__)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, origins=_allowed_origins if _allowed_origins else "*")

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./credentials.json")
ZKP_SERVICE_URL = os.getenv("ZKP_SERVICE_URL", "http://localhost:8080")


def _google_configured() -> tuple[bool, str]:
    return google_ocr.validate_credentials(GOOGLE_CREDENTIALS_PATH)


def _get_image_bytes(req) -> bytes:
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
    })


@app.route("/ocr", methods=["POST"])
def ocr():
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
    try:
        image_bytes = _get_image_bytes(request)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    try:
        passport_data, full_text, confidence = google_ocr.analyze_passport_image(image_bytes)
        return jsonify({"success": True, "text": full_text, "data": passport_data, "confidence": confidence})
    except google_ocr.GoogleOCRError as exc:
        return jsonify({"success": False, "error": str(exc)}), exc.http_status


@app.route("/generate-proof", methods=["POST"])
def generate_proof():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    try:
        resp = http.post(f"{ZKP_SERVICE_URL}/generate-proof", json=body, timeout=30)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": f"Failed to reach ZKP service: {e}"}), 502


@app.route("/proof-status/<job_id>", methods=["GET"])
def proof_status(job_id):
    try:
        resp = http.get(f"{ZKP_SERVICE_URL}/proof-status/{job_id}", timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": f"Failed to reach ZKP service: {e}"}), 502


@app.route("/attestation", methods=["GET"])
def attestation():
    try:
        resp = http.get(f"{ZKP_SERVICE_URL}/attestation", timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": f"Failed to reach ZKP service: {e}"}), 502


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    valid, message = _google_configured()
    if not valid:
        print(f"WARNING: {message}")
    else:
        print(f"Google Cloud credentials OK ({GOOGLE_CREDENTIALS_PATH})")
    print(f"ZKP service: {ZKP_SERVICE_URL}")

    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
