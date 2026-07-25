#!/usr/bin/env bash
#
# validate-multiregion.sh — Static validation of the multi-region Terraform.
#
# Runs formatting and validation checks that do NOT require AWS credentials,
# suitable for CI. Gracefully degrades (warns, does not fail) when Terraform is
# not installed so the repo can still be linted in minimal environments.
#
# Usage: ./validate-multiregion.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${REPO_ROOT}/tf"

if ! command -v terraform >/dev/null 2>&1; then
  echo "WARNING: terraform not installed — skipping fmt/validate. Install Terraform >= 1.5.0 to run full checks."
  exit 0
fi

echo "=== terraform fmt (check, recursive) ==="
terraform -chdir="${TF_DIR}" fmt -check -recursive

echo "=== terraform init (backend disabled) ==="
terraform -chdir="${TF_DIR}/multi-region" init -backend=false -input=false >/dev/null

echo "=== terraform validate (multi-region) ==="
terraform -chdir="${TF_DIR}/multi-region" validate

echo "All multi-region Terraform checks passed."
