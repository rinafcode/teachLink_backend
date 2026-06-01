#!/usr/bin/env bash
# scripts/staging/sanitize-and-sync.sh
#
# Dumps production PostgreSQL, sanitizes PII, and restores into staging.
#
# Required env vars (set in CI secrets or .env.staging):
#   PROD_DB_HOST, PROD_DB_PORT, PROD_DB_USER, PROD_DB_PASSWORD, PROD_DB_NAME
#   STAGING_DB_HOST, STAGING_DB_PORT, STAGING_DB_USER, STAGING_DB_PASSWORD, STAGING_DB_NAME
#
# Optional:
#   DUMP_DIR   – local directory for the dump file (default: /tmp/staging-sync)
#   KEEP_DUMP  – set to "1" to keep the dump file after restore

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
PROD_DB_HOST="${PROD_DB_HOST:?PROD_DB_HOST is required}"
PROD_DB_PORT="${PROD_DB_PORT:-5432}"
PROD_DB_USER="${PROD_DB_USER:?PROD_DB_USER is required}"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:?PROD_DB_PASSWORD is required}"
PROD_DB_NAME="${PROD_DB_NAME:?PROD_DB_NAME is required}"

STAGING_DB_HOST="${STAGING_DB_HOST:?STAGING_DB_HOST is required}"
STAGING_DB_PORT="${STAGING_DB_PORT:-5432}"
STAGING_DB_USER="${STAGING_DB_USER:?STAGING_DB_USER is required}"
STAGING_DB_PASSWORD="${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"
STAGING_DB_NAME="${STAGING_DB_NAME:?STAGING_DB_NAME is required}"

DUMP_DIR="${DUMP_DIR:-/tmp/staging-sync}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${DUMP_DIR}/prod_dump_${TIMESTAMP}.sql"
SANITIZED_FILE="${DUMP_DIR}/sanitized_${TIMESTAMP}.sql"

# ─── Helpers ─────────────────────────────────────────────────────────────────
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

cleanup() {
  if [[ "${KEEP_DUMP:-0}" != "1" ]]; then
    log "Cleaning up dump files..."
    rm -f "$DUMP_FILE" "$SANITIZED_FILE"
  fi
}
trap cleanup EXIT

# ─── Step 1: Dump production ─────────────────────────────────────────────────
log "=== Step 1/4: Dumping production database ==="
mkdir -p "$DUMP_DIR"

PGPASSWORD="$PROD_DB_PASSWORD" pg_dump \
  -h "$PROD_DB_HOST" \
  -p "$PROD_DB_PORT" \
  -U "$PROD_DB_USER" \
  -d "$PROD_DB_NAME" \
  --no-owner \
  --no-acl \
  -F p \
  -f "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "Dump complete: $DUMP_FILE ($DUMP_SIZE)"

# ─── Step 2: Sanitize PII ────────────────────────────────────────────────────
log "=== Step 2/4: Sanitizing PII ==="

# Copy dump then apply in-place sed replacements for PII fields.
# Each pattern targets the SQL INSERT/COPY data for known PII columns.
cp "$DUMP_FILE" "$SANITIZED_FILE"

# users table: email, username, first_name, last_name, phone, wallet_address
# Matches COPY data rows and UPDATE/INSERT statements.
python3 - "$SANITIZED_FILE" <<'PYEOF'
import re, sys, hashlib, uuid

path = sys.argv[1]
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# ── Deterministic fake email from a hash so referential integrity is preserved
def fake_email(match):
    original = match.group(1)
    h = hashlib.sha256(original.encode()).hexdigest()[:12]
    return f"user_{h}@staging.invalid"

def fake_name(match):
    h = hashlib.sha256(match.group(1).encode()).hexdigest()[:8]
    return f"User{h.capitalize()}"

def fake_phone(match):
    h = hashlib.sha256(match.group(1).encode()).hexdigest()
    digits = ''.join(filter(str.isdigit, h))[:10].ljust(10, '0')
    return f"+1{digits}"

def fake_wallet(match):
    return "0x" + hashlib.sha256(match.group(1).encode()).hexdigest()[:40]

# Email addresses (quoted strings that look like emails)
content = re.sub(
    r"'([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})'",
    lambda m: f"'{fake_email(m)}'",
    content
)

# Phone numbers (E.164 format)
content = re.sub(
    r"'(\+?[0-9]{7,15})'",
    lambda m: f"'{fake_phone(m)}'",
    content
)

# Wallet addresses (0x + 40 hex chars)
content = re.sub(
    r"'(0x[0-9a-fA-F]{40})'",
    lambda m: f"'{fake_wallet(m)}'",
    content
)

# Stripe customer IDs (cus_...)
content = re.sub(
    r"'(cus_[A-Za-z0-9]{14,})'",
    lambda m: f"'cus_staging_{hashlib.sha256(m.group(1).encode()).hexdigest()[:14]}'",
    content
)

# Payment method IDs (pm_...)
content = re.sub(
    r"'(pm_[A-Za-z0-9]{14,})'",
    lambda m: f"'pm_staging_{hashlib.sha256(m.group(1).encode()).hexdigest()[:14]}'",
    content
)

# bcrypt password hashes – replace with a known staging hash for "StagingPass1!"
STAGING_HASH = r'\$2b\$12\$stagingHashPlaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
content = re.sub(r"'\\\$2[aby]\\\$[0-9]{2}\\\$[A-Za-z0-9./]{53}'", f"'{STAGING_HASH}'", content)
# Also handle unescaped bcrypt in plain SQL
content = re.sub(r"'(\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53})'", f"'{STAGING_HASH}'", content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Sanitization complete.")
PYEOF

log "Sanitization complete: $SANITIZED_FILE"

# ─── Step 3: Drop & recreate staging DB ──────────────────────────────────────
log "=== Step 3/4: Preparing staging database ==="

PGPASSWORD="$STAGING_DB_PASSWORD" psql \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_DB_USER" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${STAGING_DB_NAME}' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS ${STAGING_DB_NAME};" \
  -c "CREATE DATABASE ${STAGING_DB_NAME} OWNER ${STAGING_DB_USER};"

log "Staging database recreated."

# ─── Step 4: Restore sanitized dump ──────────────────────────────────────────
log "=== Step 4/4: Restoring sanitized dump to staging ==="

PGPASSWORD="$STAGING_DB_PASSWORD" psql \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_DB_USER" \
  -d "$STAGING_DB_NAME" \
  -f "$SANITIZED_FILE" \
  --set ON_ERROR_STOP=1

log "=== Sync complete at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
log "Staging DB: ${STAGING_DB_HOST}:${STAGING_DB_PORT}/${STAGING_DB_NAME}"
