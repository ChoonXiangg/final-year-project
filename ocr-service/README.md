# OCR Service

Python Flask microservice that extracts structured passport data from images using **Google Cloud Vision API** (`DOCUMENT_TEXT_DETECTION`).

## Architecture

```
passport-app (React Native)
        │  HTTP POST /ocr/passport
        ▼
app.py (Flask)
        │
        ▼
google_ocr.py  —  MRZ parsing, image preprocessing, confidence scoring
        │
        ▼
vision_client.py  —  Google Cloud Vision API calls (retry, error mapping)
        │  HTTPS
        ▼
Google Cloud Vision API
```

**Files**

| File | Purpose |
|------|---------|
| `app.py` | Flask routes: `/health`, `/ocr`, `/ocr/passport` |
| `google_ocr.py` | Image preprocessing, MRZ detection and parsing, confidence scoring |
| `vision_client.py` | Google Vision API client — HTTP calls and retry logic |
| `test_app.py` | pytest suite (integration + unit tests) |
| `.env.example` | Required environment variables |

---

## Setup

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Enable the **Cloud Vision API** for your project (APIs & Services → Library → search "Cloud Vision API").
3. Go to **IAM & Admin → Service Accounts** → Create a service account.
4. Assign the role **Cloud Vision API User**.
5. Under the service account, go to **Keys → Add Key → Create new key → JSON**.
6. Save the downloaded file as `ocr-service/credentials.json`.

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Optional
FLASK_PORT=5000
FLASK_DEBUG=false
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the server

```bash
python app.py
```

The server starts on `http://localhost:5000` (or the port in `FLASK_PORT`).

---

## API Reference

### `GET /health`

Returns the service status and credential validity.

**Response**

```json
{
  "status": "healthy",
  "google_configured": true,
  "credentials_message": "OK",
  "credentials_file": "./credentials.json",
  "project_id": "my-project-id"
}
```

`status` is `"healthy"` when credentials are valid, `"degraded"` otherwise.

---

### `POST /ocr`

Extract raw text from any image.

**Request** — choose one format:

```
Content-Type: application/json
{"image": "<base64-encoded image>"}
```

```
Content-Type: multipart/form-data
image=<file upload>
```

**Response (success)**

```json
{
  "success": true,
  "text": "Full raw OCR text...",
  "lines": ["line 1", "line 2"]
}
```

**Response (error)**

```json
{"success": false, "error": "Missing 'image' field in JSON body."}
```

---

### `POST /ocr/passport`

Extract structured passport data from a passport image. Parses the MRZ (Machine Readable Zone) from the bottom of the passport.

**Request** — same formats as `/ocr`.

**Response (MRZ detected)**

```json
{
  "success": true,
  "text": "<raw OCR text>",
  "data": {
    "surname": "OSULLIVAN",
    "givenNames": "LAUREN",
    "fullName": "LAUREN OSULLIVAN",
    "nationality": "IRL",
    "documentNumber": "XN5003778",
    "dateOfBirth": "880504",
    "dateOfExpiry": "230915",
    "sex": "F",
    "age": 37,
    "issuingCountry": "IRL",
    "personalNumber": ""
  },
  "confidence": {
    "overall": 0.9442,
    "mrz_line1": 0.9429,
    "mrz_line2": 0.9455
  }
}
```

**Response (MRZ not found — unclear image or not a passport)**

```json
{
  "success": true,
  "text": "<raw OCR text>",
  "data": null,
  "confidence": {"overall": null, "mrz_line1": null, "mrz_line2": null}
}
```

**Response (API error)**

```json
{"success": false, "error": "Google Vision API quota exceeded. ..."}
```

**Field reference**

| Field | Type | Notes |
|-------|------|-------|
| `surname` | string | Family name from MRZ |
| `givenNames` | string | Given names from MRZ |
| `fullName` | string | `givenNames + " " + surname` |
| `nationality` | string | 3-letter ICAO country code |
| `documentNumber` | string | Passport number (9 chars, trailing `<` stripped) |
| `dateOfBirth` | string | `YYMMDD` format |
| `dateOfExpiry` | string | `YYMMDD` format |
| `sex` | string | `"M"`, `"F"`, or `"unspecified"` |
| `age` | integer | Age in years calculated from DOB |
| `issuingCountry` | string | 3-letter ICAO country code |
| `personalNumber` | string | Optional; empty string if not present |

**Confidence scores**

| Field | Description |
|-------|-------------|
| `overall` | `min(mrz_line1, mrz_line2)` — worst-case line accuracy |
| `mrz_line1` | Average per-character score for MRZ line 1 (name line) |
| `mrz_line2` | Average per-character score for MRZ line 2 (data line) |

Scores are in `[0.0, 1.0]`. `null` means Vision did not return confidence data.

---

## How MRZ Detection Works

```
Image
  │
  ├─ Pass 1: Crop bottom 20 % → greyscale → 2× upscale → autocontrast → sharpen
  │          Send to Vision with language_hints=["und"]
  │          If MRZ found → return result
  │
  └─ Pass 2 (fallback): Send full image to Vision
                         Return result (data=null if MRZ not found)
```

Pass 1 removes the photo and decorative background that confuse Vision, and `language_hints=["und"]` prevents Vision from biasing OCR-B glyphs toward any natural-language alphabet.

**Supported image formats:** JPEG, PNG, WebP, HEIC/HEIF (including iPhone `.heic` files)

---

## Error Codes

| HTTP | Exception | Cause |
|------|-----------|-------|
| 400 | — | Missing or invalid image in request |
| 403 | `AuthError` | Invalid or missing service account credentials |
| 422 | `BadImageError` | Image rejected by Vision (corrupt, too small, < 64×64 px) |
| 429 | `QuotaError` | Google Vision API quota exceeded |
| 503 | `ServiceUnavailableError` | Vision API unavailable after 4 attempts with exponential backoff |
| 500 | `GoogleOCRError` | Unexpected Vision API error |

Transient errors (503) are retried automatically with delays of 1 s, 2 s, and 4 s before returning 503.

---

## Running Tests

```bash
pytest test_app.py -v
```

Coverage report is printed automatically (configured in `pytest.ini`):

```
Name               Stmts   Miss  Cover
--------------------------------------
app.py                62     11    82%
google_ocr.py        143     45    69%
vision_client.py      42     24    43%
--------------------------------------
TOTAL                247     80    68%
```

`vision_client.py` has lower coverage by design — it contains the real HTTP calls to Google which cannot run without live credentials. The logic in `app.py` and `google_ocr.py` is ~82–83% covered.

---

## Pricing

Google Cloud Vision pricing (as of 2025):

| Volume | Price |
|--------|-------|
| First 1,000 units/month | Free |
| 1,001 – 5,000,000 units/month | $1.50 per 1,000 |

Each call to `/ocr` or `/ocr/passport` uses up to **2 Vision units** (one for the preprocessed crop, one for the full-image fallback if the first pass finds no MRZ).

The free tier of 1,000 units/month is sufficient for development and testing.
