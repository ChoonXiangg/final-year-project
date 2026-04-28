"""
Unit tests for the ZKP Flask service (app.py).
No real proof generation or TEE hardware required — subprocesses and sockets
are mocked throughout.

Run from the zkp/ directory:
    pytest test_app.py -v
"""
from unittest.mock import patch, MagicMock
import pytest
from app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_healthy_when_binary_found(self, client):
        with patch("os.path.isfile", return_value=True), \
             patch("os.access", return_value=True):
            r = client.get("/health")
        assert r.status_code == 200
        body = r.get_json()
        assert body["status"] == "healthy"
        assert body["binary_found"] is True

    def test_degraded_when_binary_missing(self, client):
        with patch("os.path.isfile", return_value=False):
            r = client.get("/health")
        assert r.status_code == 200
        body = r.get_json()
        assert body["status"] == "degraded"
        assert body["binary_found"] is False

    def test_returns_binary_path(self, client):
        with patch("os.path.isfile", return_value=True), \
             patch("os.access", return_value=True):
            r = client.get("/health")
        assert "evm_binary" in r.get_json()


# ---------------------------------------------------------------------------
# /generate-proof
# ---------------------------------------------------------------------------

class TestGenerateProof:
    _VALID_BODY = {
        "passport": {"documentNumber": "A1234567"},
        "walletAddress": "0x1234567890123456789012345678901234567890",
        "verifierAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    }

    def test_missing_body_returns_400(self, client):
        r = client.post("/generate-proof", data="not json", content_type="text/plain")
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_missing_passport_returns_400(self, client):
        r = client.post("/generate-proof", json={
            "walletAddress": "0x1234567890123456789012345678901234567890",
            "verifierAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        })
        assert r.status_code == 400

    def test_missing_wallet_returns_400(self, client):
        r = client.post("/generate-proof", json={
            "passport": {"documentNumber": "A1234567"},
            "verifierAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        })
        assert r.status_code == 400

    def test_missing_verifier_returns_400(self, client):
        r = client.post("/generate-proof", json={
            "passport": {"documentNumber": "A1234567"},
            "walletAddress": "0x1234567890123456789012345678901234567890",
        })
        assert r.status_code == 400

    def test_valid_request_returns_job_id(self, client):
        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            r = client.post("/generate-proof", json=self._VALID_BODY)
        assert r.status_code == 200
        body = r.get_json()
        assert "jobId" in body
        assert body["status"] == "pending"

    def test_each_request_gets_unique_job_id(self, client):
        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            r1 = client.post("/generate-proof", json=self._VALID_BODY)
            r2 = client.post("/generate-proof", json=self._VALID_BODY)
        assert r1.get_json()["jobId"] != r2.get_json()["jobId"]


# ---------------------------------------------------------------------------
# /proof-status/<job_id>
# ---------------------------------------------------------------------------

class TestProofStatus:
    def test_unknown_job_returns_404(self, client):
        r = client.get("/proof-status/nonexistent-job-id")
        assert r.status_code == 404
        assert "error" in r.get_json()

    def test_pending_job_returns_pending_status(self, client):
        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            create_r = client.post("/generate-proof", json={
                "passport": {"documentNumber": "A1234567"},
                "walletAddress": "0x1234567890123456789012345678901234567890",
                "verifierAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            })
        job_id = create_r.get_json()["jobId"]
        r = client.get(f"/proof-status/{job_id}")
        assert r.status_code == 200
        assert r.get_json()["status"] == "pending"

    def test_response_does_not_include_created_at(self, client):
        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            create_r = client.post("/generate-proof", json={
                "passport": {"documentNumber": "A1234567"},
                "walletAddress": "0x1234567890123456789012345678901234567890",
                "verifierAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            })
        job_id = create_r.get_json()["jobId"]
        r = client.get(f"/proof-status/{job_id}")
        assert "created_at" not in r.get_json()


# ---------------------------------------------------------------------------
# /attestation
# ---------------------------------------------------------------------------

class TestAttestation:
    def test_returns_503_outside_tee(self, client):
        with patch("os.path.exists", return_value=False):
            r = client.get("/attestation")
        assert r.status_code == 503
        assert "error" in r.get_json()

    def test_returns_quote_inside_tee(self, client):
        with patch("os.path.exists", return_value=True), \
             patch("app._tappd_quote", return_value={"quote": "deadbeef", "event_log": "log"}):
            r = client.get("/attestation")
        assert r.status_code == 200
        body = r.get_json()
        assert body["status"] == "ok"
        assert body["quote"] == "deadbeef"

    def test_returns_500_when_tappd_fails(self, client):
        with patch("os.path.exists", return_value=True), \
             patch("app._tappd_quote", side_effect=Exception("socket error")):
            r = client.get("/attestation")
        assert r.status_code == 500
        assert "error" in r.get_json()
