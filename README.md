# IoM (Internet of Materials)

A modern web application for tracking and managing building materials, components, and structures for government and municipal use.

## Features

### Building Object Management

- Hierarchical structure management (building → floors → rooms → components)
- Material properties and metadata tracking
- Component relationship mapping
- CRUD operations for all building elements

## Technology Stack

- **Frontend Framework**: Next.js 16, React 19
- **Language**: TypeScript
- **UI Libraries**: Tailwind CSS, Radix UI Components
- **Form Management**: React Hook Form, Zod validation
- **Security**: mTLS (Mutual TLS) Authentication
- **Error Tracking**: Sentry (tunneled through `/api/sentry-tunnel`)

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm package manager
- HTTPS certificates for local development

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/maeconomy-org/iom-ui.git
   cd iom-ui
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Setup environment variables

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` — see `.env.example` for all available variables. The minimum required:

   ```bash
   BASE_URL=https://example.com    # Base URL for all API services
   HERE_API_KEY=your-key           # HERE Maps API key
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=your-password
   ```

4. Start the development server

   ```bash
   pnpm dev
   ```

5. Open your browser at `https://localhost:3000`

## Authentication

The application uses **user-initiated JWT authentication** with mTLS certificates for secure access.

### Authentication Flow

1. **User visits the application** — No automatic authentication occurs
2. **User clicks "Authorize with Certificate"** — Browser prompts for certificate selection
3. **mTLS authentication** — Certificate is used to obtain JWT token
4. **JWT token storage** — Token is stored in localStorage for persistence
5. **Automatic token refresh** — SDK handles token refresh 5 minutes before expiration
6. **Cross-tab synchronization** — Tokens work across multiple browser tabs

## Project Structure

```
src/
├── app/                # Next.js app router pages
│   ├── (auth)/        # Auth page
│   ├── objects/       # Objects management
│   ├── groups/        # Groups management
│   ├── models/        # Models management
│   ├── processes/     # I/O Processes
│   ├── import/        # Import workflow
│   └── help/          # Help documentation
├── components/        # React components
│   ├── ui/           # Shared UI components (shadcn/ui)
│   └── ...           # Feature components
├── lib/              # Cross-cutting utilities
├── hooks/            # React hooks
├── contexts/         # React contexts
├── constants/        # Application constants
└── messages/         # i18n translations (en, nl)
```

## Available Scripts

- `pnpm dev` — Start the development server (webpack)
- `pnpm build` — Build for production
- `pnpm start` — Start the production server
- `pnpm lint` — Run ESLint
- `pnpm format` — Format code with Prettier
- `pnpm typecheck` — TypeScript type checking
- `pnpm test` — Run tests in watch mode
- `pnpm test:run` — Run tests once

## Configuration

All configuration is **runtime** — no environment variables are needed at build time. A single Docker image works across all environments.

- Environment variables are read at runtime via `buildRuntimeConfig()` in `src/constants/client.ts`
- The `/api/config` endpoint serves client-side configuration
- An inline `<script>` tag in `layout.tsx` provides config on first load (zero network requests)
- Config is cached in localStorage for 24 hours

See `CLAUDE.md` for the full environment variable reference.

## Deployment

See `docs/RELEASE-GUIDE.md` for the complete release, deployment, and source map upload workflow.
