#!/bin/bash
# =============================================================================
# Upload Source Maps to Sentry
# =============================================================================
# Uploads source maps from a Next.js build to Sentry project(s).
#
# Usage:
#   ./scripts/upload-sourcemaps.sh                    # Upload to ALL projects in .sentry-projects
#   ./scripts/upload-sourcemaps.sh iom-ui-dev         # Upload to specific project(s)
#   ./scripts/upload-sourcemaps.sh iob-ui-dev iom-ui-dev  # Multiple projects
#
# Auth token is read from (in order):
#   1. SENTRY_AUTH_TOKEN env var
#   2. .env.local file in project root
#
# Optional env vars:
#   SENTRY_ORG        - Organization slug (default: recheck-io)
#   SENTRY_RELEASE    - Release name (default: package.json version)
#   SENTRY_URL        - API URL (default: https://de.sentry.io/)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Load SENTRY_AUTH_TOKEN from .env.local if not already set
if [ -z "$SENTRY_AUTH_TOKEN" ] && [ -f ".env.local" ]; then
    TOKEN=$(grep -E '^SENTRY_AUTH_TOKEN=' .env.local 2>/dev/null | head -1 | cut -d'=' -f2-)
    if [ -n "$TOKEN" ]; then
        export SENTRY_AUTH_TOKEN="$TOKEN"
        echo -e "${BLUE}Loaded SENTRY_AUTH_TOKEN from .env.local${NC}"
    fi
fi

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
    echo -e "${RED}Error: SENTRY_AUTH_TOKEN not found${NC}"
    echo ""
    echo "Set it in one of:"
    echo "  1. .env.local file:  SENTRY_AUTH_TOKEN=sntrys_xxx"
    echo "  2. Environment: export SENTRY_AUTH_TOKEN=sntrys_xxx"
    echo ""
    echo "Generate one at: https://recheck-io.sentry.io/settings/auth-tokens/"
    exit 1
fi

# Defaults
SENTRY_ORG="${SENTRY_ORG:-recheck-io}"
SENTRY_URL="${SENTRY_URL:-https://de.sentry.io/}"
RELEASE="${SENTRY_RELEASE:-$(node -p "require('./package.json').version")}"
CONFIG_FILE="$PROJECT_ROOT/.sentry-projects"

# Determine target projects
PROJECTS=()
if [ $# -gt 0 ]; then
    # Projects passed as arguments
    PROJECTS=("$@")
elif [ -n "$SENTRY_PROJECT" ]; then
    # Single project from env var
    PROJECTS=("$SENTRY_PROJECT")
elif [ -f "$CONFIG_FILE" ]; then
    # Read from config file (skip empty lines and comments)
    while IFS= read -r line; do
        line=$(echo "$line" | sed 's/#.*//' | xargs)
        [ -n "$line" ] && PROJECTS+=("$line")
    done < "$CONFIG_FILE"
fi

if [ ${#PROJECTS[@]} -eq 0 ]; then
    echo -e "${RED}Error: No Sentry projects specified${NC}"
    echo ""
    echo "Option A: Pass projects as arguments:"
    echo "  $0 iom-ui-dev iom-ui-prod"
    echo ""
    echo "Option B: Create .sentry-projects file with one project per line"
    exit 1
fi

# Check if build exists
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}No .next directory found. Running build...${NC}"
    pnpm build
    echo ""
fi

# Check for source maps
MAP_COUNT=$(find .next -name '*.map' 2>/dev/null | wc -l | tr -d ' ')
if [ "$MAP_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No source maps found in .next/${NC}"
    echo "Source maps may have been deleted. Run 'pnpm build' first."
    exit 1
fi

echo -e "${GREEN}Sentry Source Map Upload${NC}"
echo "  Org:      $SENTRY_ORG"
echo "  Release:  $RELEASE"
echo "  Projects: ${PROJECTS[*]}"
echo "  Maps:     $MAP_COUNT files"
echo ""

# sentry-cli v3: --url is a global option (before subcommand)
CLI="pnpm sentry-cli --url $SENTRY_URL"
FAILED=()

for PROJECT in "${PROJECTS[@]}"; do
    echo -e "${BLUE}[$PROJECT]${NC} Uploading source maps..."

    if ! (
        $CLI releases \
            --org "$SENTRY_ORG" \
            --project "$PROJECT" \
            new "$RELEASE" 2>&1 &&

        $CLI sourcemaps upload \
            --org "$SENTRY_ORG" \
            --project "$PROJECT" \
            --release "$RELEASE" \
            --url-prefix '~/_next/static' \
            .next/static 2>&1 &&

        $CLI sourcemaps upload \
            --org "$SENTRY_ORG" \
            --project "$PROJECT" \
            --release "$RELEASE" \
            --url-prefix '~/.next/server' \
            .next/server 2>&1 &&

        $CLI releases \
            --org "$SENTRY_ORG" \
            --project "$PROJECT" \
            finalize "$RELEASE" 2>&1
    ); then
        echo -e "${RED}[$PROJECT] Failed${NC}"
        FAILED+=("$PROJECT")
    else
        echo -e "${GREEN}[$PROJECT] Done${NC}"
    fi
    echo ""
done

# Summary
SUCCEEDED=$(( ${#PROJECTS[@]} - ${#FAILED[@]} ))
echo -e "${GREEN}Upload complete: $SUCCEEDED/${#PROJECTS[@]} projects${NC}"

if [ ${#FAILED[@]} -gt 0 ]; then
    echo -e "${RED}Failed: ${FAILED[*]}${NC}"
    exit 1
fi
