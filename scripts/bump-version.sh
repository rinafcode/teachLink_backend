#!/bin/bash

# Release automation script for semantic versioning
# Usage: ./scripts/bump-version.sh [major|minor|patch] [--dry-run]

set -e

RELEASE_TYPE="${1:-patch}"
DRY_RUN="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch|auto)$ ]]; then
  echo -e "${RED}Error: Invalid release type '$RELEASE_TYPE'${NC}"
  echo "Usage: $0 [major|minor|patch|auto] [--dry-run]"
  exit 1
fi

# Check if git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Git working directory is not clean${NC}"
  echo "Please commit or stash all changes before releasing"
  git status
  exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${RED}Error: Must be on 'main' branch to release (currently on '$CURRENT_BRANCH')${NC}"
  exit 1
fi

# Pull latest from remote
echo -e "${YELLOW}Pulling latest from remote...${NC}"
git pull origin main

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Calculate next version
NODE_OPTIONS=--max-old-space-size=4096 node scripts/get-next-version.js "$RELEASE_TYPE"
NEXT_VERSION=$(cat .next_version)
rm -f .next_version

echo -e "${GREEN}Next version: $NEXT_VERSION${NC}"

# Generate changelog
NODE_OPTIONS=--max-old-space-size=4096 node scripts/generate-changelog.js "$NEXT_VERSION"

# Show what will be changed
echo -e "\n${YELLOW}=== Changes to be made ===${NC}"
echo "- Version bumped: $CURRENT_VERSION -> $NEXT_VERSION"
echo "- Files modified: package.json, package-lock.json, CHANGELOG.md"
echo "- Git tag created: v$NEXT_VERSION"
echo "- GitHub release created"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo -e "\n${YELLOW}DRY RUN MODE - No changes committed${NC}"
  echo -e "${YELLOW}Run without --dry-run to commit changes${NC}"
  exit 0
fi

# Confirm before proceeding
echo -e "\n${YELLOW}Continue with release? (y/N)${NC}"
read -r CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
  echo -e "${YELLOW}Release cancelled${NC}"
  exit 0
fi

# Update version in package.json
echo -e "${YELLOW}Updating package.json...${NC}"
npm version "$NEXT_VERSION" --no-git-tag-version

# Verify build and tests pass
echo -e "${YELLOW}Running build and tests...${NC}"
npm run build
npm run test:ci

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: bump version to $NEXT_VERSION"

# Create tag
echo -e "${YELLOW}Creating git tag...${NC}"
git tag -a "v$NEXT_VERSION" -m "Release v$NEXT_VERSION"

# Push to remote
echo -e "${YELLOW}Pushing to remote...${NC}"
git push origin main --follow-tags

echo -e "\n${GREEN}✓ Release v$NEXT_VERSION completed successfully!${NC}"
echo -e "${GREEN}✓ Tag v$NEXT_VERSION pushed to remote${NC}"
echo -e "${YELLOW}The GitHub Actions release workflow will now publish the release${NC}"
