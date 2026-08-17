#!/usr/bin/env bash
#
# Schema drift check.
#
# Verifies that entity definitions do not drift from the migration-produced
# schema. The check fails when `migration:generate --check` reports ANY
# difference between the entity metadata and the schema produced by running
# all migrations — model changes without a corresponding migration are
# rejected.
set -uo pipefail

cd "$(dirname "$0")/.."

if npx typeorm-ts-node-commonjs migration:generate -d src/config/datasource.ts \
  --check drift-check >/dev/null 2>&1; then
  echo "✓ No schema drift."
  exit 0
fi

echo "::error::Schema drift detected — the database schema produced by migrations does not match the entity definitions."
echo "Run 'pnpm run migration:generate' to create a migration for the change, or align the entity definitions."
exit 1
