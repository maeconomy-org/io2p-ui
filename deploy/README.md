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

# Create certificates directory
mkdir -p certs
# Copy your certificate.pem to certs/
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

### Build-time Variables (NEXT*PUBLIC*\*)

These are baked into the Docker image during build. Set them in GitHub Actions:

| Variable                   | Description         | Where to Set   |
| -------------------------- | ------------------- | -------------- |
| `NEXT_PUBLIC_BASE_API_URL` | Base API endpoint   | GitHub Vars    |
| `NEXT_PUBLIC_UUID_API_URL` | UUID API endpoint   | GitHub Vars    |
| `NEXT_PUBLIC_HERE_API_KEY` | HERE Maps API key   | GitHub Secrets |
| `NEXT_PUBLIC_SENTRY_DSN`   | Sentry DSN (client) | GitHub Secrets |

### Runtime Variables (Server-side)

These are set in `.env` on each VM:

| Variable               | Description                    | Required |
| ---------------------- | ------------------------------ | -------- |
| `IMAGE_TAG`            | Docker image tag to deploy     | Yes      |
| `PORT`                 | Port to expose (default: 3000) | No       |
| `CERTIFICATE_PASSWORD` | mTLS certificate password      | Yes      |
| `VERIFY_CERTIFICATES`  | Verify SSL certs (true/false)  | No       |
| `SENTRY_DSN`           | Sentry DSN (server)            | Yes      |
| `SENTRY_ENABLED`       | Enable Sentry (true/false)     | No       |

## Directory Structure on VM

```
/opt/iom-ui/
├── docker-compose.yml
├── .env                 # Your configuration
├── .env.example         # Template
├── .previous            # Auto-generated for rollback
├── deploy.sh            # Deployment script
└── certs/
    └── certificate.pem  # Your mTLS certificate
```

## Versioning & Rollback

### Creating a Release

```bash
# On your local machine
git tag v1.0.0
git push origin v1.0.0
```

This triggers a build with tags: `v1.0.0`, `1.0`, `1`

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

Each VM has its own `.env` with different `CERTIFICATE_PASSWORD`, etc.

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

### Certificate issues

```bash
# Verify certificate is mounted
docker compose exec iom-ui ls -la /app/certs/

# Check certificate permissions
ls -la certs/
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
