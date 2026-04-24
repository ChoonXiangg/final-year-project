# ─── Stage 1: Build the evm binary ───────────────────────────────────────────
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential pkg-config libssl-dev git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (stable, matches zkp/rust-toolchain)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"

# Install SP1 toolchain (needed by sp1-build to compile the ZK program ELF)
RUN curl -L https://sp1up.succinct.xyz | bash
ENV PATH="/root/.sp1/bin:$PATH"
RUN sp1up --version v5.2.2

# Copy ZKP source and build the evm binary
WORKDIR /zkp
COPY . .
WORKDIR /zkp/script
RUN cargo build --release --bin evm

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /zkp/target/release/evm /usr/local/bin/evm

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app \
    && mkdir -p /tmp/proofs && chown appuser:appuser /tmp/proofs
USER appuser

EXPOSE 8080

ENV FLASK_PORT=8080
ENV FLASK_DEBUG=false
ENV EVM_BINARY=/usr/local/bin/evm
ENV PROOF_DIR=/tmp/proofs

CMD ["python", "app.py"]
