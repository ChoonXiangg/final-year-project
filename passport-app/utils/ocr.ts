const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Types — mirror the backend /ocr/passport response contract
// ---------------------------------------------------------------------------

export interface PassportData {
  surname: string;
  givenNames: string;
  fullName: string;
  nationality: string;
  documentNumber: string;
  /** Date of birth in YYMMDD format */
  dateOfBirth: string;
  /** Date of expiry in YYMMDD format */
  dateOfExpiry: string;
  sex: 'M' | 'F' | 'unspecified';
  age: number | null;
  issuingCountry: string;
  personalNumber: string;
}

export interface OCRConfidence {
  overall: number | null;
  mrz_line1: number | null;
  mrz_line2: number | null;
}

export interface PassportOCRResult {
  success: boolean;
  /** Raw text extracted by Google Vision */
  text?: string;
  /** Structured passport fields, or null if MRZ was not detected */
  data?: PassportData | null;
  confidence?: OCRConfidence;
  error?: string;
}

export interface TextOCRResult {
  success: boolean;
  text?: string;
  lines?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Send a base64-encoded image to /ocr/passport and return structured
 * passport data parsed from the MRZ.
 *
 * Returns `data: null` (success=true) when the image was processed but no
 * MRZ could be detected — ask the user to retake the photo.
 */
export async function extractPassportDataFromAPI(
  imageBase64: string
): Promise<PassportOCRResult> {
  try {
    const response = await fetch(`${OCR_API_URL}/ocr/passport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: `Could not reach OCR service at ${OCR_API_URL}. Is the backend running?`,
    };
  }
}

/**
 * Send a base64-encoded image to /ocr and return the raw extracted text.
 */
export async function extractTextFromImage(
  imageBase64: string
): Promise<TextOCRResult> {
  try {
    const response = await fetch(`${OCR_API_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: `Could not reach OCR service at ${OCR_API_URL}. Is the backend running?`,
    };
  }
}
