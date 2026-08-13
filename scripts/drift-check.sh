#!/usr/bin/env bash
#
# Schema drift check.
#
# Verifies that entity definitions do not drift from the migration-produced
# schema. The check fails when *new* drift is introduced.
#
# Pre-existing drift between entities and migrations (index/column/constraint
# naming mismatches accumulated before a baseline migration existed) is
# captured in scripts/known-drift.txt. That snapshot is tracked separately in
# a follow-up issue; this script only fails when the drift differs from the
# snapshot, i.e. when a model change lacks a corresponding migration.
set -uo pipefail

cd "$(dirname "$0")/.."

OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

if npx typeorm-ts-node-commonjs migration:generate -d src/config/datasource.ts \
  --check drift-check >"$OUT" 2>&1; then
  echo "✓ No schema drift."
  exit 0
fi

# Drift detected: extract the generated SQL statements, normalize whitespace,
# and compare against the known-drift snapshot.
grep -oE "await queryRunner\.query\(\`[^\`]*" "$OUT" \
  | sed 's/^await queryRunner\.query(`//' \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
  | sort >"${OUT}.current"

if diff -q scripts/known-drift.txt "${OUT}.current" >/dev/null 2>&1; then
  echo "⚠ Schema drift matches the known snapshot (see issue #1194). No new drift."
  exit 0
fi

echo "::error::New schema drift detected — model changes exist without a corresponding migration."
echo "Run 'pnpm run migration:generate' to create the missing migration, or update scripts/known-drift.txt."
echo ""
diff scripts/known-drift.txt "${OUT}.current" | head -60
exit 1
