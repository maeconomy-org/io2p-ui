#!/bin/bash

# Release script for iom-ui
# Usage: ./scripts/release.sh [patch|minor|major]
# For dev: ./scripts/release-dev.sh (creates v1.0.0-dev tag)

set -e

VERSION_TYPE=${1:-patch}
CURRENT_BRANCH=$(git branch --show-current)

echo "Starting release process..."
echo "Version bump type: $VERSION_TYPE"
echo "Branch: $CURRENT_BRANCH"

# Ensure we're on main branch
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "Error: Please switch to main branch before releasing"
    echo "For dev releases, use: ./scripts/release-dev.sh"
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

# Bump version and create tag
echo "Bumping version ($VERSION_TYPE)..."
npm version $VERSION_TYPE --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: v$NEW_VERSION"

# Commit the version change and create tag
echo "Committing version change..."
git add package.json pnpm-lock.yaml 2>/dev/null || git add package.json
git commit -m "release: v$NEW_VERSION"

echo "Creating git tag..."
git tag "v$NEW_VERSION"

# Push changes and tags
echo "Pushing changes and tags..."
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

echo ""
echo "Release v$NEW_VERSION created!"
echo "Docker tags: $NEW_VERSION, latest, main"
