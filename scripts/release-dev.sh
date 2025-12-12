#!/bin/bash

# Dev release script for iom-ui
# Bumps version and creates a dev tag to trigger Docker build
# Usage: ./scripts/release-dev.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}
CURRENT_BRANCH=$(git branch --show-current)

echo "Starting dev release..."
echo "Version bump: $VERSION_TYPE"
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

# Bump version
echo "Bumping version ($VERSION_TYPE)..."
npm version $VERSION_TYPE --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
DEV_TAG="v${NEW_VERSION}-dev"

echo "New version: $NEW_VERSION"
echo "Dev tag: $DEV_TAG"

# Commit the version change
echo "Committing version change..."
git add package.json pnpm-lock.yaml 2>/dev/null || git add package.json
git commit -m "release: $DEV_TAG"

# Delete existing dev tag with same version if exists
git tag -d "$DEV_TAG" 2>/dev/null || true
git push origin ":refs/tags/$DEV_TAG" 2>/dev/null || true

# Create and push new dev tag
git tag "$DEV_TAG"

# Push commit and tag
git push origin $CURRENT_BRANCH
git push origin "$DEV_TAG"

echo ""
echo "Dev release $DEV_TAG created!"
echo "Docker tags: ${NEW_VERSION}-dev, dev, sha-xxx"
