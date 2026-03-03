FROM python:3.12-slim

WORKDIR /app

# libheif1 is required by pillow-heif for HEIC/HEIF (iPhone photo) support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY app.py google_ocr.py vision_client.py ./

# Run as non-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

ENV GOOGLE_APPLICATION_CREDENTIALS=/secrets/credentials.json
ENV FLASK_PORT=5000
ENV FLASK_DEBUG=false

# 2 workers, 120s timeout to accommodate slow Vision API calls
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
