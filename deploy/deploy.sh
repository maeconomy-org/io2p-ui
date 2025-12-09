#!/bin/bash
# =============================================================================
# IoM UI Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh              - Deploy/update to latest
#   ./deploy.sh v1.0.0       - Deploy specific version
#   ./deploy.sh rollback     - Rollback to previous version
#   ./deploy.sh status       - Show current status
#   ./deploy.sh logs         - Show logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Copy .env.example to .env and configure it first"
    exit 1
fi

# Check if certs directory exists
if [ ! -d "certs" ]; then
    echo -e "${YELLOW}Warning: certs/ directory not found${NC}"
    echo "Create certs/ directory and add your certificates"
fi

# Load current IMAGE_TAG from .env
source .env

case "${1:-update}" in
    update|"")
        TAG="${2:-$IMAGE_TAG}"
        echo -e "${GREEN}🚀 Deploying IoM UI (tag: $TAG)${NC}"
        
        # Save current tag for rollback
        if docker compose ps -q iom-ui 2>/dev/null | grep -q .; then
            CURRENT=$(docker inspect --format='{{.Config.Image}}' iom-ui 2>/dev/null | cut -d: -f2)
            if [ -n "$CURRENT" ]; then
                echo "PREVIOUS_TAG=$CURRENT" > .previous
                echo -e "${YELLOW}Previous version saved: $CURRENT${NC}"
            fi
        fi
        
        # Update IMAGE_TAG in .env if different
        if [ "$TAG" != "$IMAGE_TAG" ]; then
            sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env
            rm -f .env.bak
        fi
        
        # Pull and deploy
        docker compose pull
        docker compose up -d
        
        echo -e "${GREEN}✅ Deployment complete${NC}"
        docker compose ps
        ;;
        
    rollback)
        if [ -f ".previous" ]; then
            source .previous
            echo -e "${YELLOW}🔄 Rolling back to: $PREVIOUS_TAG${NC}"
            sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=$PREVIOUS_TAG/" .env
            rm -f .env.bak
            docker compose up -d
            echo -e "${GREEN}✅ Rollback complete${NC}"
        else
            echo -e "${RED}No previous version found${NC}"
            exit 1
        fi
        ;;
        
    status)
        echo -e "${GREEN}📊 Current Status${NC}"
        docker compose ps
        echo ""
        echo -e "${GREEN}📦 Current Image${NC}"
        docker inspect --format='Image: {{.Config.Image}}' iom-ui 2>/dev/null || echo "Container not running"
        ;;
        
    logs)
        docker compose logs -f --tail=100
        ;;
        
    stop)
        echo -e "${YELLOW}⏹️ Stopping IoM UI${NC}"
        docker compose down
        ;;
        
    *)
        # Assume it's a version tag
        TAG="$1"
        echo -e "${GREEN}🚀 Deploying IoM UI (tag: $TAG)${NC}"
        sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env
        rm -f .env.bak
        docker compose pull
        docker compose up -d
        echo -e "${GREEN}✅ Deployment complete${NC}"
        ;;
esac
