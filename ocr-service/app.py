import os
import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

app = Flask(__name__)
CORS(app)

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./credentials.json")
GOOGLE_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")


def _google_configured():
    return os.path.isfile(GOOGLE_CREDENTIALS_PATH)


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
    """Extract raw text from an image using Google Cloud Vision."""
    return jsonify({"success": False, "error": "Not implemented yet — pending Task 3 & 4"}), 501


@app.route("/ocr/passport", methods=["POST"])
def ocr_passport():
    """Extract structured passport data from an image using Google Cloud Vision."""
    return jsonify({"success": False, "error": "Not implemented yet — pending Task 3 & 4"}), 501


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
