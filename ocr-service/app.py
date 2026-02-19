import os
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import google_ocr

load_dotenv()

app = Flask(__name__)
CORS(app)

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./credentials.json")
GOOGLE_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")


def _google_configured() -> bool:
    return os.path.isfile(GOOGLE_CREDENTIALS_PATH)


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
    configured = _google_configured()
    return jsonify({
        "status": "healthy" if configured else "degraded",
        "google_configured": configured,
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
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


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
          "surname": "...", "givenNames": "...", "fullName": "...",
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

    try:
        passport_data, full_text, _confidence = google_ocr.analyze_passport_image(image_bytes)
        return jsonify({"success": True, "text": full_text, "data": passport_data})
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not _google_configured():
        print("WARNING: Google Cloud credentials not found.")
        print(f"Expected credentials file at: {GOOGLE_CREDENTIALS_PATH}")
        print("See .env.example for setup instructions.")
    else:
        print(f"Google Cloud credentials loaded from: {GOOGLE_CREDENTIALS_PATH}")
        if GOOGLE_PROJECT_ID:
            print(f"Project ID: {GOOGLE_PROJECT_ID}")

    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
