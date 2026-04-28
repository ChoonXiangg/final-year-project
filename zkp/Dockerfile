# ─── Stage 1: Build the evm binary ───────────────────────────────────────────
# The ZK program ELF is pre-compiled locally and copied in via the build context
# (target/elf-compilation/ is included in .dockerignore via negation).
# SP1_SKIP_PROGRAM_BUILD=true tells sp1-build to use the existing ELF instead of
# recompiling it with the SP1 RISC-V toolchain, which avoids toolchain conflicts.
FROM --platform=linux/amd64 rust:1.82-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev g++ wget ca-certificates libclang-dev \
    && wget -q https://go.dev/dl/go1.22.4.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz \
    && rm go1.22.4.linux-amd64.tar.gz \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /zkp
COPY . .

WORKDIR /zkp/script
RUN SP1_SKIP_PROGRAM_BUILD=true cargo build --release --bin evm

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 python:3.12-slim

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
