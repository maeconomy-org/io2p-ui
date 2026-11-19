# IoM UI Deployment Guide

## Overview

This guide covers deploying IoM UI using Docker containers from GitHub Container Registry (GHCR).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  dev branch │    │ main branch │    │ Tags (v1.0.0)       │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                       │             │
│         ▼                  ▼                       ▼             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              GitHub Actions (docker-build.yml)              ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                  │                       │             │
│         ▼                  ▼                       ▼             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  GitHub Container Registry                  ││
│  │  ghcr.io/maeconomy-org/iom-ui:dev                          ││
│  │  ghcr.io/maeconomy-org/iom-ui:main                         ││
│  │  ghcr.io/maeconomy-org/iom-ui:v1.0.0                       ││
│  │  ghcr.io/maeconomy-org/iom-ui:sha-abc1234                  ││
│  │  ghcr.io/maeconomy-org/iom-ui:20241206-120000              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Your VMs                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   VM 1 (dev)    │  │   VM 2 (prod)   │  │   VM 3 (prod)   │  │
│  │  docker compose │  │  docker compose │  │  docker compose │  │
│  │  IMAGE_TAG=dev  │  │  IMAGE_TAG=main │  │  IMAGE_TAG=main │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Initial Setup on VM

```bash
# Create deployment directory
mkdir -p /opt/iom-ui
cd /opt/iom-ui

# Download deployment files
curl -O https://raw.githubusercontent.com/maeconomy-org/iom-ui/main/deploy/docker-compose.yml
curl -O https://raw.githubusercontent.com/maeconomy-org/iom-ui/main/deploy/.env.example
curl -O https://raw.githubusercontent.com/maeconomy-org/iom-ui/main/deploy/deploy.sh
chmod +x deploy.sh

# Configure environment
cp .env.example .env
nano .env  # Edit with your values
```

### 2. Login to GHCR

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 3. Deploy

```bash
./deploy.sh
```

## Image Tags

| Tag               | Description             | Use Case            |
| ----------------- | ----------------------- | ------------------- |
| `main`            | Latest from main branch | Production          |
| `dev`             | Latest from dev branch  | Staging/Testing     |
| `v1.0.0`          | Semantic version        | Production (pinned) |
| `sha-abc1234`     | Specific commit         | Debugging/Rollback  |
| `20241206-120000` | Timestamp               | Easy rollback       |

## Deployment Commands

```bash
# Deploy latest main
./deploy.sh

# Deploy specific version
./deploy.sh v1.0.0

# Deploy dev branch
./deploy.sh dev

# Deploy specific commit
./deploy.sh sha-abc1234

# Rollback to previous version
./deploy.sh rollback

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Stop application
./deploy.sh stop
```

## Environment Variables

All configuration is **runtime** via `.env` — no build-time variables needed. One Docker image works across all environments.

See `.env.example` for the full list. Key variables:

| Variable                  | Description                                                                                                                                          | Required |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `IMAGE_TAG`               | Docker image tag to deploy                                                                                                                           | Yes      |
| `BASE_URL`                | Base API endpoint                                                                                                                                    | Yes      |
| `GH_ORG`                  | GitHub org for image registry                                                                                                                        | Yes      |
| `EXTERNAL_PORT`           | Host port published on 127.0.0.1 (default: 3000). Pick a unique value per stack when running multiple UIs on one VM — the container port stays 3000. | Yes      |
| `SENTRY_DSN`              | Sentry DSN                                                                                                                                           | No       |
| `SENTRY_ENABLED`          | Enable Sentry (default: false)                                                                                                                       | No       |
| `MAX_IMPORT_FILE_SIZE_MB` | Per-file cap for xlsx/csv imports — parsed into memory (default: 100)                                                                                | No       |
| `MAX_ATTACHMENT_SIZE_MB`  | Per-file cap for object attachments — streamed to S3 in 8 MB parts × max 128 parts (default: 1024 = 1 GB hard ceiling)                               | No       |

`SENTRY_RELEASE` is auto-detected from the app version baked into the image at build time. No need to set it unless you want to override.

## Directory Structure on VM

```
/opt/iom-ui/
├── docker-compose.yml
├── .env                 # Your configuration
├── .env.example         # Template
├── .previous            # Auto-generated for rollback
├── deploy.sh            # Deployment script
```

## Versioning & Rollback

### Creating a Release

Use the release scripts (see `docs/RELEASE-GUIDE.md`):

```bash
./scripts/release.sh patch        # Production: v1.0.1
./scripts/release-dev.sh patch    # Dev: v1.0.1-dev
```

This bumps the version, creates a git tag, pushes, and triggers CI to build the Docker image.

### Rollback Procedure

```bash
# Automatic rollback to previous version
./deploy.sh rollback

# Or manually specify a version
./deploy.sh v0.9.0

# Or use a specific commit
./deploy.sh sha-abc1234
```

## Multi-VM Deployment

For deploying the same code to multiple VMs with different configurations:

### Option 1: Same Image, Different Env

Each VM has its own `.env` with different `SENTRY_DSN`, etc.

### Option 2: Different Branches

- Dev VMs: `IMAGE_TAG=dev`
- Prod VMs: `IMAGE_TAG=main`

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs

# Check container status
docker compose ps

# Verify image exists
docker images | grep iom-ui
```

### Pull fails

```bash
# Re-authenticate with GHCR
docker logout ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## Health Checks

The container includes a health check that pings `http://localhost:3000/` every 30 seconds.

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' iom-ui
```

## Logs

```bash
# Follow logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific timeframe
docker compose logs --since 1h
```
