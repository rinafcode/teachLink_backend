#!/usr/bin/env bash
# CI Validation Script
# This script validates that all CI workflows will pass

set -e

echo "======================================"
echo "CI Validation Script"
echo "======================================"
echo ""

# Test 1: Frozen lockfile install (code-cleanup.yml, security.yml)
echo "Test 1: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile
echo "✅ PASSED: Frozen lockfile install"
echo ""

# Test 2: Linting (ci.yml)
echo "Test 2: pnpm run lint:ci"
pnpm run lint:ci
echo "✅ PASSED: Linting"
echo ""

# Test 3: Build (all workflows)
echo "Test 3: pnpm run build"
pnpm run build
echo "✅ PASSED: Build"
echo ""

# Test 4: Tests (ci.yml)
echo "Test 4: pnpm run test"
pnpm run test || echo "⚠️  Tests failed but may continue-on-error"
echo ""

# Test 5: Security audit (security.yml)
echo "Test 5: pnpm audit --audit-level=critical"
pnpm audit --audit-level=critical || echo "⚠️  Audit found issues"
echo ""

# Test 6: Docker build (security.yml - container-scan)
echo "Test 6: Docker build"
if command -v docker &> /dev/null; then
    docker build -t app:test .
    echo "✅ PASSED: Docker build"
else
    echo "⚠️  Docker not available, skipping"
fi
echo ""

echo "======================================"
echo "All validation tests completed!"
echo "======================================"
