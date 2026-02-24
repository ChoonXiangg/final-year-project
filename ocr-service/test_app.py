"""
Integration tests for the OCR Flask service (app.py) and unit tests for the
pure functions in google_ocr.py.

Google Vision API calls are mocked so no live credentials or network access
are required.  Run from the ocr-service/ directory with:

    pytest test_app.py -v
"""
import base64
import io
import re
from datetime import date as real_date
from unittest.mock import patch

import pytest

import google_ocr
from app import app as flask_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

def _minimal_png() -> bytes:
    """1×1 white pixel PNG — smallest valid image for multipart tests."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), (255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


def _b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode()


_PNG = _minimal_png()
_PNG_B64 = _b64(_PNG)

_PASSPORT_DATA = {
    "surname": "DOE",
    "givenNames": "JOHN",
    "fullName": "JOHN DOE",
    "nationality": "GBR",
    "documentNumber": "123456789",
    "dateOfBirth": "850101",
    "dateOfExpiry": "300101",
    "sex": "M",
    "age": 40,
    "issuingCountry": "GBR",
    "personalNumber": "",
}

_CONFIDENCE = {"overall": 0.95, "mrz_line1": 0.95, "mrz_line2": 0.97}
_NO_CONFIDENCE = {"overall": None, "mrz_line1": None, "mrz_line2": None}


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_healthy_when_credentials_valid(self, client):
        with patch("google_ocr.validate_credentials", return_value=(True, "OK")):
            r = client.get("/health")
        assert r.status_code == 200
        body = r.get_json()
        assert body["status"] == "healthy"
        assert body["google_configured"] is True
        assert "credentials_message" in body

    def test_degraded_when_credentials_missing(self, client):
        with patch("google_ocr.validate_credentials", return_value=(False, "File not found")):
            r = client.get("/health")
        assert r.status_code == 200
        body = r.get_json()
        assert body["status"] == "degraded"
        assert body["google_configured"] is False
        assert "File not found" in body["credentials_message"]


# ---------------------------------------------------------------------------
# /ocr
# ---------------------------------------------------------------------------

class TestOCR:
    def test_json_base64_returns_text_and_lines(self, client):
        with patch("google_ocr.extract_text_from_image", return_value=("hello world", ["hello world"])):
            r = client.post("/ocr", json={"image": _PNG_B64})
        assert r.status_code == 200
        body = r.get_json()
        assert body["success"] is True
        assert body["text"] == "hello world"
        assert body["lines"] == ["hello world"]

    def test_multipart_upload_accepted(self, client):
        with patch("google_ocr.extract_text_from_image", return_value=("hello", ["hello"])):
            r = client.post(
                "/ocr",
                data={"image": (io.BytesIO(_PNG), "passport.png")},
                content_type="multipart/form-data",
            )
        assert r.status_code == 200
        assert r.get_json()["success"] is True

    def test_missing_image_field_returns_400(self, client):
        r = client.post("/ocr", json={})
        assert r.status_code == 400
        body = r.get_json()
        assert body["success"] is False
        assert "image" in body["error"].lower()

    def test_invalid_base64_returns_400(self, client):
        r = client.post("/ocr", json={"image": "not!!valid==base64"})
        assert r.status_code == 400
        assert r.get_json()["success"] is False

    def test_quota_error_returns_429(self, client):
        with patch("google_ocr.extract_text_from_image", side_effect=google_ocr.QuotaError("quota")):
            r = client.post("/ocr", json={"image": _PNG_B64})
        assert r.status_code == 429
        assert r.get_json()["success"] is False


# ---------------------------------------------------------------------------
# /ocr/passport
# ---------------------------------------------------------------------------

class TestOCRPassport:
    def test_valid_passport_returns_structured_data(self, client):
        with patch("google_ocr.analyze_passport_image", return_value=(_PASSPORT_DATA, "raw text", _CONFIDENCE)):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        assert r.status_code == 200
        body = r.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["surname"] == "DOE"
        assert data["givenNames"] == "JOHN"
        assert data["nationality"] == "GBR"
        assert data["sex"] == "M"
        assert isinstance(data["age"], int)

    def test_date_fields_are_yymmdd(self, client):
        with patch("google_ocr.analyze_passport_image", return_value=(_PASSPORT_DATA, "raw", _CONFIDENCE)):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        data = r.get_json()["data"]
        assert re.match(r"^\d{6}$", data["dateOfBirth"])
        assert re.match(r"^\d{6}$", data["dateOfExpiry"])

    def test_no_mrz_returns_success_with_null_data(self, client):
        with patch("google_ocr.analyze_passport_image", return_value=(None, "some text", _NO_CONFIDENCE)):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        assert r.status_code == 200
        body = r.get_json()
        assert body["success"] is True
        assert body["data"] is None

    def test_missing_image_returns_400(self, client):
        r = client.post("/ocr/passport", json={})
        assert r.status_code == 400
        assert r.get_json()["success"] is False

    def test_auth_error_returns_403(self, client):
        with patch("google_ocr.analyze_passport_image", side_effect=google_ocr.AuthError("bad creds")):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        assert r.status_code == 403
        assert r.get_json()["success"] is False

    def test_service_unavailable_returns_503(self, client):
        with patch("google_ocr.analyze_passport_image", side_effect=google_ocr.ServiceUnavailableError("down")):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        assert r.status_code == 503
        assert r.get_json()["success"] is False

    def test_confidence_has_all_keys(self, client):
        with patch("google_ocr.analyze_passport_image", return_value=(_PASSPORT_DATA, "raw", _CONFIDENCE)):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        conf = r.get_json()["confidence"]
        assert set(conf.keys()) == {"overall", "mrz_line1", "mrz_line2"}

    def test_confidence_overall_is_min_of_lines(self, client):
        conf = {"overall": 0.91, "mrz_line1": 0.91, "mrz_line2": 0.97}
        with patch("google_ocr.analyze_passport_image", return_value=(_PASSPORT_DATA, "raw", conf)):
            r = client.post("/ocr/passport", json={"image": _PNG_B64})
        c = r.get_json()["confidence"]
        assert c["overall"] == min(c["mrz_line1"], c["mrz_line2"])

    def test_multipart_passport_accepted(self, client):
        with patch("google_ocr.analyze_passport_image", return_value=(_PASSPORT_DATA, "raw", _CONFIDENCE)):
            r = client.post(
                "/ocr/passport",
                data={"image": (io.BytesIO(_PNG), "passport.png")},
                content_type="multipart/form-data",
            )
        assert r.status_code == 200
        assert r.get_json()["success"] is True


# ---------------------------------------------------------------------------
# google_ocr unit tests  (pure functions — no Vision API calls)
# ---------------------------------------------------------------------------

# MRZ lines from the Irish passport (Lauren O'Sullivan) — verified against
# the live API during manual testing.
_IRISH_LINE1 = "P<IRLOSULLIVAN<<LAUREN<<<<<<<<<<<<<<<<<<<<<<"
_IRISH_LINE2 = "XN50037786IRL8805049F2309154<<<<<<<<<<<<<<<8"
_IRISH_MRZ_TEXT = f"{_IRISH_LINE1}\n{_IRISH_LINE2}\n"

_FROZEN_TODAY = real_date(2026, 2, 24)


@pytest.fixture
def frozen_date():
    """Freeze date.today() to 2026-02-24 for deterministic age calculations."""
    with patch("google_ocr.date") as mock_date:
        mock_date.today.return_value = _FROZEN_TODAY
        mock_date.side_effect = real_date  # keep date(y, m, d) construction working
        yield mock_date


class TestCheckDigit:
    def test_all_filler_is_zero(self):
        assert google_ocr._check_digit("<<<<<<") == 0

    def test_empty_string_is_zero(self):
        assert google_ocr._check_digit("") == 0

    def test_digits_dob(self):
        # DOB "880504" → check digit 9  (Irish passport, verified live)
        assert google_ocr._check_digit("880504") == 9

    def test_alphanumeric_doc_number(self):
        # Doc number "XN5003778" → check digit 6  (Irish passport, verified live)
        assert google_ocr._check_digit("XN5003778") == 6

    def test_digits_expiry(self):
        # Expiry "230915" → check digit 4  (Irish passport, verified live)
        assert google_ocr._check_digit("230915") == 4


class TestCleanMrzLine:
    def test_strips_leading_trailing_whitespace(self):
        assert google_ocr._clean_mrz_line("  P<MYS  ") == "P<MYS"

    def test_removes_internal_spaces(self):
        assert google_ocr._clean_mrz_line("P<MYS MAHATHIR") == "P<MYSMAHATHIR"

    def test_uppercases(self):
        assert google_ocr._clean_mrz_line("p<mys") == "P<MYS"

    def test_replaces_guillemets(self):
        assert google_ocr._clean_mrz_line("A«B»C") == "A<B<C"

    def test_replaces_unicode_guillemets(self):
        assert google_ocr._clean_mrz_line("A\u00ABB\u00BBC") == "A<B<C"


class TestFindMrzLines:
    def test_valid_mrz_returns_line_pair(self):
        result = google_ocr._find_mrz_lines(_IRISH_MRZ_TEXT)
        assert result is not None
        assert result == (_IRISH_LINE1, _IRISH_LINE2)

    def test_no_mrz_returns_none(self):
        assert google_ocr._find_mrz_lines("No MRZ here at all") is None

    def test_single_mrz_line_returns_none(self):
        assert google_ocr._find_mrz_lines(_IRISH_LINE1 + "\n") is None

    def test_skips_pairs_where_first_line_is_not_P(self):
        line_a = "A" + "<" * 43   # valid length but starts with A, not P
        line_b = "X" + "0" * 43
        assert google_ocr._find_mrz_lines(f"{line_a}\n{line_b}\n") is None

    def test_handles_internal_space_in_line(self):
        # Vision sometimes inserts a space mid-line; _clean_mrz_line removes it
        spaced_line2 = _IRISH_LINE2[:20] + " " + _IRISH_LINE2[20:]
        result = google_ocr._find_mrz_lines(f"{_IRISH_LINE1}\n{spaced_line2}\n")
        assert result is not None


class TestCalculateAge:
    def test_birthday_already_passed_this_year(self, frozen_date):
        # Born Jan 1 1985 — birthday already passed (today is Feb 24 2026)
        assert google_ocr._calculate_age("850101") == 41

    def test_birthday_not_yet_this_year(self, frozen_date):
        # Born Dec 1 2000 — birthday not yet reached
        assert google_ocr._calculate_age("001201") == 25

    def test_century_heuristic_assigns_2000s_for_small_yy(self, frozen_date):
        # yy=25 ≤ current_yy=26 → born 2025, not 1925
        assert google_ocr._calculate_age("251201") == 0  # Dec 2025, not yet 1 yr old

    def test_invalid_month_returns_none(self):
        assert google_ocr._calculate_age("999999") is None

    def test_too_short_returns_none(self):
        assert google_ocr._calculate_age("123") is None


class TestParseNames:
    def test_surname_and_given_names(self):
        s, g = google_ocr._parse_names("OSULLIVAN<<LAUREN<<<<<<<<<<<<<<<<<<<<<<<")
        assert s == "OSULLIVAN"
        assert g == "LAUREN"

    def test_single_component_malay_name(self):
        # No << separator → entire field is surname, no given names
        s, g = google_ocr._parse_names("MAHATHIR<BIN<IDRUS<<<<<<<<<<<<<<<<<<<<")
        assert s == "MAHATHIR BIN IDRUS"
        assert g == ""

    def test_multi_word_given_names(self):
        s, g = google_ocr._parse_names("SMITH<<JOHN<WILLIAM<<<<<<<<<<<<<<<<<<<<")
        assert s == "SMITH"
        assert g == "JOHN WILLIAM"

    def test_all_filler_given_names_is_empty(self):
        s, g = google_ocr._parse_names("DOE<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
        assert s == "DOE"
        assert g == ""


class TestParseMrz:
    def test_valid_mrz_returns_all_fields(self):
        result = google_ocr.parse_mrz(_IRISH_MRZ_TEXT)
        assert result is not None
        assert result["surname"] == "OSULLIVAN"
        assert result["givenNames"] == "LAUREN"
        assert result["fullName"] == "LAUREN OSULLIVAN"
        assert result["nationality"] == "IRL"
        assert result["documentNumber"] == "XN5003778"
        assert result["dateOfBirth"] == "880504"
        assert result["dateOfExpiry"] == "230915"
        assert result["sex"] == "F"
        assert result["issuingCountry"] == "IRL"
        assert result["personalNumber"] == ""
        assert isinstance(result["age"], int)

    def test_no_mrz_returns_none(self):
        assert google_ocr.parse_mrz("PASSPORT\nNAME: JOHN\nNO MRZ") is None

    def test_sex_unspecified_for_filler(self):
        line2 = _IRISH_LINE2[:20] + "<" + _IRISH_LINE2[21:]
        result = google_ocr.parse_mrz(f"{_IRISH_LINE1}\n{line2}\n")
        assert result["sex"] == "unspecified"

    def test_personal_number_strips_filler(self):
        result = google_ocr.parse_mrz(_IRISH_MRZ_TEXT)
        assert result["personalNumber"] == ""  # all-filler personal number → ""


class TestValidateCredentials:
    def test_missing_file(self, tmp_path):
        ok, msg = google_ocr.validate_credentials(str(tmp_path / "nonexistent.json"))
        assert ok is False
        assert "not found" in msg.lower()

    def test_invalid_json(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("not json {{{{")
        ok, msg = google_ocr.validate_credentials(str(f))
        assert ok is False
        assert "json" in msg.lower()

    def test_missing_required_fields(self, tmp_path):
        f = tmp_path / "incomplete.json"
        f.write_text('{"type": "service_account", "project_id": "x"}')
        ok, msg = google_ocr.validate_credentials(str(f))
        assert ok is False
        assert "missing" in msg.lower()

    def test_wrong_account_type(self, tmp_path):
        f = tmp_path / "wrong.json"
        f.write_text(
            '{"type": "oauth2", "project_id": "x", "private_key": "k", "client_email": "e@x.com"}'
        )
        ok, msg = google_ocr.validate_credentials(str(f))
        assert ok is False

    def test_valid_credentials(self, tmp_path):
        f = tmp_path / "valid.json"
        f.write_text(
            '{"type": "service_account", "project_id": "x", "private_key": "k", "client_email": "e@x.com"}'
        )
        ok, msg = google_ocr.validate_credentials(str(f))
        assert ok is True
        assert msg == "OK"


class TestPreprocessForMrz:
    def _make_png(self, width: int, height: int) -> bytes:
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (width, height), (200, 200, 200)).save(buf, format="PNG")
        return buf.getvalue()

    def test_returns_non_empty_bytes(self):
        result = google_ocr._preprocess_for_mrz(self._make_png(100, 200))
        assert isinstance(result, bytes) and len(result) > 0

    def test_output_is_valid_png(self):
        from PIL import Image
        result = google_ocr._preprocess_for_mrz(self._make_png(100, 200))
        img = Image.open(io.BytesIO(result))
        assert img.format == "PNG"

    def test_output_dimensions_match_crop_and_upscale(self):
        from PIL import Image
        # 100×200 input → bottom 20% = 40px tall, upscaled 2× → 80px tall, 200px wide
        result = google_ocr._preprocess_for_mrz(self._make_png(100, 200))
        img = Image.open(io.BytesIO(result))
        assert img.height == 80
        assert img.width == 200
