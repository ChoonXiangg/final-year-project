import io
import os
import re
import time
import json
from datetime import date

import pillow_heif
from PIL import Image, ImageFilter, ImageOps
from google.cloud import vision

# Register HEIC/HEIF opener so Pillow can read iPhone photos (.heic, .heif,
# and .avif files that are actually HEIC containers).
pillow_heif.register_heif_opener(allow_incorrect_headers=True)
from google.api_core import exceptions as gexc

_VISION_TIMEOUT = 30        # seconds per API call
_MAX_ATTEMPTS   = 4         # 1 initial + 3 retries
_RETRY_DELAYS   = [1, 2, 4] # seconds between attempts


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class GoogleOCRError(RuntimeError):
    """Base exception for all Google OCR failures."""
    http_status: int = 500


class AuthError(GoogleOCRError):
    """Invalid or missing service-account credentials."""
    http_status = 403


class QuotaError(GoogleOCRError):
    """Google Vision API quota exceeded."""
    http_status = 429


class BadImageError(GoogleOCRError):
    """Image is corrupt, too small, or cannot be processed by Vision."""
    http_status = 422


class ServiceUnavailableError(GoogleOCRError):
    """Google Vision API is temporarily unavailable (transient)."""
    http_status = 503


# ---------------------------------------------------------------------------
# Credentials validation (used by /health)
# ---------------------------------------------------------------------------

def validate_credentials(path: str) -> tuple[bool, str]:
    """
    Check that the credentials JSON file exists and has the expected structure.
    Returns (is_valid, message).
    Does NOT make a network call.
    """
    if not os.path.isfile(path):
        return False, f"Credentials file not found: {path}"
    try:
        with open(path) as f:
            creds = json.load(f)
    except json.JSONDecodeError:
        return False, "Credentials file is not valid JSON."

    required = {"type", "project_id", "private_key", "client_email"}
    missing = required - set(creds.keys())
    if missing:
        return False, f"Credentials file is missing fields: {missing}"

    if creds.get("type") != "service_account":
        return False, f"Expected type 'service_account', got '{creds.get('type')}'."

    return True, "OK"


# ---------------------------------------------------------------------------
# Internal: Vision API call with retry
# ---------------------------------------------------------------------------

def _get_client() -> vision.ImageAnnotatorClient:
    return vision.ImageAnnotatorClient()


def _call_vision_api(
    image_bytes: bytes,
    image_context: vision.ImageContext | None = None,
) -> vision.AnnotateImageResponse:
    """
    Call Google Vision DOCUMENT_TEXT_DETECTION with timeout and exponential
    backoff retry for transient errors.

    Raises:
        AuthError             — bad credentials (403)
        QuotaError            — quota exceeded (429)
        BadImageError         — image rejected by Vision (422)
        ServiceUnavailableError — still unavailable after all retries (503)
        GoogleOCRError        — any other Google API error (500)
    """
    client = _get_client()
    image  = vision.Image(content=image_bytes)
    last_exc: GoogleOCRError | None = None

    for attempt in range(_MAX_ATTEMPTS):
        if attempt > 0:
            time.sleep(_RETRY_DELAYS[attempt - 1])

        try:
            response = client.document_text_detection(
                image=image,
                image_context=image_context,
                timeout=_VISION_TIMEOUT,
            )
        except (gexc.PermissionDenied, gexc.Unauthenticated) as e:
            raise AuthError(
                f"Google Vision authentication failed. "
                f"Check your service account credentials. ({e.message})"
            ) from e
        except gexc.ResourceExhausted as e:
            raise QuotaError(
                f"Google Vision API quota exceeded. "
                f"Check your GCP quota limits. ({e.message})"
            ) from e
        except gexc.InvalidArgument as e:
            raise BadImageError(
                f"Image could not be processed by Google Vision. "
                f"Ensure it is a valid JPEG/PNG and at least 64×64 px. ({e.message})"
            ) from e
        except (gexc.ServiceUnavailable, gexc.DeadlineExceeded) as e:
            last_exc = ServiceUnavailableError(
                f"Google Vision is temporarily unavailable "
                f"(attempt {attempt + 1}/{_MAX_ATTEMPTS}). ({e.message})"
            )
            continue  # retry
        except gexc.GoogleAPIError as e:
            raise GoogleOCRError(f"Google Vision API error: {e.message}") from e

        # Handle application-level errors returned inside the response
        if response.error.message:
            raise GoogleOCRError(
                f"Google Vision returned an error: {response.error.message}"
            )

        return response

    raise last_exc  # exhausted retries for transient error


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_image(image_bytes: bytes) -> tuple[str, list[str]]:
    """
    Call Google Cloud Vision DOCUMENT_TEXT_DETECTION on raw image bytes.

    Returns:
        (full_text, lines) where lines is the text split by newline,
        with blank lines removed.

    Raises:  GoogleOCRError (or a subclass) on API failure.
    """
    response = _call_vision_api(image_bytes)
    full_text = response.full_text_annotation.text if response.full_text_annotation else ""
    lines = [ln for ln in full_text.splitlines() if ln.strip()]
    return full_text, lines


def _extract_mrz_confidence(response: vision.AnnotateImageResponse, mrz_text: str) -> dict:
    """
    Walk the Vision response symbol tree to compute per-MRZ-line confidence.
    Returns a dict with keys: overall, mrz_line1, mrz_line2.
    Returns None values if confidence data is unavailable.
    """
    if not response.full_text_annotation.pages:
        return {"overall": None, "mrz_line1": None, "mrz_line2": None}

    # Collect all (char, confidence) pairs in document order
    symbol_data: list[tuple[str, float]] = []
    for page in response.full_text_annotation.pages:
        for block in page.blocks:
            for para in block.paragraphs:
                for word in para.words:
                    for symbol in word.symbols:
                        symbol_data.append((symbol.text, symbol.confidence))

    # Rebuild full text from symbols to align with mrz positions
    symbol_text = "".join(ch for ch, _ in symbol_data)

    # Find confidence for each MRZ line by locating it in the symbol stream
    def _line_confidence(line: str) -> float | None:
        idx = symbol_text.find(line)
        if idx == -1:
            return None
        confidences = [conf for _, conf in symbol_data[idx: idx + len(line)]]
        return round(sum(confidences) / len(confidences), 4) if confidences else None

    lines = [_clean_mrz_line(ln) for ln in mrz_text.splitlines() if ln.strip()]
    mrz_lines = [ln for ln in lines if re.match(r'^[A-Z0-9<]{44}$', ln)]

    line1_conf = _line_confidence(mrz_lines[0]) if len(mrz_lines) > 0 else None
    line2_conf = _line_confidence(mrz_lines[1]) if len(mrz_lines) > 1 else None

    confs = [c for c in [line1_conf, line2_conf] if c is not None]
    overall = round(min(confs), 4) if confs else None

    return {"overall": overall, "mrz_line1": line1_conf, "mrz_line2": line2_conf}


# ---------------------------------------------------------------------------
# MRZ parsing
# ---------------------------------------------------------------------------

def _check_digit(text: str) -> int:
    """Compute the ICAO MRZ check digit for a string."""
    weights = [7, 3, 1]
    total = 0
    for i, ch in enumerate(text):
        if ch.isdigit():
            value = int(ch)
        elif ch.isalpha():
            value = ord(ch.upper()) - ord("A") + 10
        else:
            value = 0  # '<'
        total += value * weights[i % 3]
    return total % 10


def _clean_mrz_line(raw: str) -> str:
    """
    Strip spaces and normalise common single-character OCR substitutions
    that Google Vision makes on MRZ font (OCR-B).
    """
    cleaned = raw.strip().replace(" ", "").upper()
    # Common Vision errors on MRZ font
    cleaned = cleaned.replace("«", "<").replace("»", "<")
    cleaned = cleaned.replace("\u00AB", "<").replace("\u00BB", "<")
    return cleaned


def _find_mrz_lines(text: str) -> tuple[str, str] | None:
    """
    Search extracted text for two consecutive 44-char MRZ lines.
    Returns (line1, line2) or None.
    """
    mrz_re = re.compile(r"^[A-Z0-9<]{44}$")
    candidates: list[str] = []

    for raw_line in text.splitlines():
        cleaned = _clean_mrz_line(raw_line)
        if mrz_re.match(cleaned):
            candidates.append(cleaned)

    # Find first pair where line 1 starts with 'P' (TD-3 passport)
    for i in range(len(candidates) - 1):
        if candidates[i].startswith("P"):
            return candidates[i], candidates[i + 1]

    return None


def _calculate_age(yymmdd: str) -> int | None:
    """Return age in years from a YYMMDD date string, or None on parse failure."""
    try:
        yy = int(yymmdd[0:2])
        mm = int(yymmdd[2:4])
        dd = int(yymmdd[4:6])
        # Century heuristic: years > current 2-digit year belong to the 1900s
        current_yy = date.today().year % 100
        year = 2000 + yy if yy <= current_yy else 1900 + yy
        dob = date(year, mm, dd)
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except (ValueError, IndexError):
        return None


def _parse_names(name_field: str) -> tuple[str, str]:
    """
    Split the MRZ name field (positions 5-43 of line 1) into surname and
    given names. Double-chevron '<<' separates surname from given names;
    single '<' is a space within each part.
    """
    parts = name_field.split("<<")
    surname = parts[0].replace("<", " ").strip()
    given_names = " ".join(p.replace("<", " ").strip() for p in parts[1:] if p).strip()
    return surname, given_names


def parse_mrz(text: str) -> dict | None:
    """
    Parse structured passport data from raw OCR text.

    Returns a dict matching the API contract expected by the mobile app, or
    None if no valid MRZ could be detected.

    TD-3 passport MRZ layout
    Line 1 (44 chars):
      [0]     document type  (P)
      [1]     subtype        (<)
      [2:5]   issuing country (3-letter ICAO code)
      [5:44]  name field     (SURNAME<<GIVEN<NAMES<<<...)

    Line 2 (44 chars):
      [0:9]   document number
      [9]     check digit
      [10:13] nationality
      [13:19] date of birth  (YYMMDD)
      [19]    check digit
      [20]    sex            (M / F / <)
      [21:27] date of expiry (YYMMDD)
      [27]    check digit
      [28:42] personal number
      [42]    check digit
      [43]    composite check digit
    """
    mrz = _find_mrz_lines(text)
    if not mrz:
        return None

    line1, line2 = mrz

    # --- Line 1 ---
    issuing_country = line1[2:5].replace("<", "")
    surname, given_names = _parse_names(line1[5:44])
    full_name = f"{given_names} {surname}".strip() if given_names else surname

    # --- Line 2 ---
    document_number = line2[0:9].replace("<", "")
    nationality = line2[10:13].replace("<", "")
    date_of_birth = line2[13:19]
    sex_char = line2[20]
    sex = "M" if sex_char == "M" else ("F" if sex_char == "F" else "unspecified")
    date_of_expiry = line2[21:27]
    personal_number = line2[28:42].replace("<", "")

    return {
        "surname": surname,
        "givenNames": given_names,
        "fullName": full_name,
        "nationality": nationality,
        "documentNumber": document_number,
        "dateOfBirth": date_of_birth,
        "dateOfExpiry": date_of_expiry,
        "sex": sex,
        "age": _calculate_age(date_of_birth),
        "issuingCountry": issuing_country,
        "personalNumber": personal_number,
    }


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def _preprocess_for_mrz(image_bytes: bytes) -> bytes:
    """
    Crop to the MRZ strip (bottom 20 % of the image), convert to greyscale,
    double the resolution, auto-enhance contrast, and sharpen.

    The resulting PNG is consistently easier for Vision to read: less background
    noise, larger characters, and higher contrast between the OCR-B text and the
    passport background.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("L")  # greyscale
    h = img.height
    mrz_crop = img.crop((0, int(h * 0.80), img.width, h))  # bottom 20 %
    mrz_crop = ImageOps.autocontrast(mrz_crop)
    mrz_crop = mrz_crop.resize(
        (mrz_crop.width * 2, mrz_crop.height * 2),
        Image.LANCZOS,
    )
    mrz_crop = mrz_crop.filter(ImageFilter.SHARPEN)
    buf = io.BytesIO()
    mrz_crop.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# High-level API (used by Flask endpoints)
# ---------------------------------------------------------------------------

def analyze_passport_image(image_bytes: bytes) -> tuple[dict | None, str, dict]:
    """
    Extract structured passport data and confidence scores from image bytes.

    Returns:
        (passport_data, raw_text, confidence)

        passport_data — structured dict or None if MRZ not found
        raw_text      — full OCR text from Vision
        confidence    — dict with keys: overall, mrz_line1, mrz_line2

    Strategy:
        Pass 1 — send a preprocessed crop of the MRZ zone (bottom 20 %,
                  greyscale, 2× upscale, sharpened). Cropping removes the
                  photo and decorative background that confuse Vision, and
                  upscaling makes OCR-B characters easier to read.
        Pass 2 — if Pass 1 finds no MRZ (or preprocessing fails), fall back
                  to the full image so we never silently lose data.

    Raises:  GoogleOCRError (or a subclass) on API failure.
    """
    # Pass 1: preprocessed MRZ zone
    # language_hints=["und"] disables language-specific character priors so
    # Vision does not bias OCR-B glyphs toward any natural-language alphabet.
    _mrz_context = vision.ImageContext(language_hints=["und"])
    try:
        preprocessed = _preprocess_for_mrz(image_bytes)
        response = _call_vision_api(preprocessed, image_context=_mrz_context)
        full_text = response.full_text_annotation.text if response.full_text_annotation else ""
        passport_data = parse_mrz(full_text)
        if passport_data:
            confidence = _extract_mrz_confidence(response, full_text)
            return passport_data, full_text, confidence
    except GoogleOCRError:
        raise  # quota / auth / service errors must not be swallowed
    except Exception:
        pass   # PIL failure or unexpected error → fall through

    # Pass 2: full image fallback
    response = _call_vision_api(image_bytes)
    full_text = response.full_text_annotation.text if response.full_text_annotation else ""
    passport_data = parse_mrz(full_text)
    confidence = _extract_mrz_confidence(response, full_text)
    return passport_data, full_text, confidence
