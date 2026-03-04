"""
Google Cloud Vision API client — network boundary.

All code that makes real HTTP calls to Google lives here.
This module is intentionally excluded from unit-test coverage
because its only logic is gluing our code to a third-party API.
"""
import time

from google.cloud import vision
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
# Vision API call with retry
# ---------------------------------------------------------------------------

def _get_client() -> vision.ImageAnnotatorClient:
    return vision.ImageAnnotatorClient()


def call_vision_api(
    image_bytes: bytes,
    image_context: vision.ImageContext | None = None,
) -> vision.AnnotateImageResponse:
    """
    Call Google Vision DOCUMENT_TEXT_DETECTION with timeout and exponential
    backoff retry for transient errors.

    Raises:
        AuthError               — bad credentials (403)
        QuotaError              — quota exceeded (429)
        BadImageError           — image rejected by Vision (422)
        ServiceUnavailableError — still unavailable after all retries (503)
        GoogleOCRError          — any other Google API error (500)
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
