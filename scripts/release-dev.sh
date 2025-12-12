#!/bin/bash

# Dev release script for iom-ui
# Creates a dev tag to trigger Docker build for dev branch
# Usage: ./scripts/release-dev.sh

set -e

CURRENT_BRANCH=$(git branch --show-current)

echo "Starting dev release..."
echo "Branch: $CURRENT_BRANCH"

# Ensure we're on dev branch
if [[ "$CURRENT_BRANCH" != "dev" ]]; then
    echo "Error: Please switch to dev branch"
    echo "For production releases, use: ./scripts/release.sh"
    exit 1
fi

# Ensure working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo "Error: Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
DEV_TAG="v${CURRENT_VERSION}-dev"

echo "Creating dev tag: $DEV_TAG"

# Delete existing dev tag if exists (locally and remote)
git tag -d "$DEV_TAG" 2>/dev/null || true
git push origin ":refs/tags/$DEV_TAG" 2>/dev/null || true

# Create and push new dev tag
git tag "$DEV_TAG"
git push origin "$DEV_TAG"

echo ""
echo "Dev release $DEV_TAG created!"
echo "Docker tags: ${CURRENT_VERSION}-dev, dev"
