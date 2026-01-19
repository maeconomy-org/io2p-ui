# IoM (Internet of Materials)

A modern web application for tracking and managing building materials, components, and structures for government and municipal use.

## Features

### Building Object Management

- Hierarchical structure management (building → floors → rooms → components)
- Material properties and metadata tracking
- Component relationship mapping
- CRUD operations for all building elements

## Technology Stack

- **Frontend Framework**: Next.js 15.2.4, React 19
- **Language**: TypeScript
- **UI Libraries**: Tailwind CSS, Radix UI Components
- **Form Management**: React Hook Form, Zod validation
- **Security**: mTLS (Mutual TLS) Authentication

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- NPM/PNPM package manager
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

   Create a `.env.local` file in the root directory with the following variables:

   ```bash
   # Environment Configuration
   NODE_ENV=development

   # API Configuration - New Service-Based Architecture
   AUTH_API_URL=https://auth.example.com
   REGISTRY_API_URL=https://registry.example.com
   NODE_API_URL=https://api.example.com

   # Legacy API Configuration (for backward compatibility)
   BASE_API_URL=https://api.example.com
   UUID_API_URL=https://registry.example.com

   # Sentry Configuration (Optional)
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   SENTRY_ORG=your-organization-slug
   SENTRY_PROJECT=your-project-name
   SENTRY_ENABLED=false
   SENTRY_DEBUG=false
   SENTRY_RELEASE=1.0.0

   # Application Information (Optional)
   APP_NAME="Internet of Materials"
   APP_DESCRIPTION="Material Management System"
   APP_ACRONYM="IoM"
   CONTACT_URL=https://example.com/contact
   SUPPORT_EMAIL=support@internetofmaterials.com

   # Import Limits (Optional)
   MAX_FILE_SIZE_MB=100
   MAX_IMPORT_PAYLOAD_MB=100
   MAX_OBJECTS_PER_IMPORT=50000
   ```

4. Setup HTTPS certificates

5. Start the development server

   ```bash
   pnpm dev
   ```

6. Open your browser
   Navigate to `https://localhost:3000`

## Authentication

The application uses **user-initiated JWT authentication** with mTLS certificates for secure access.

### Authentication Flow

1. **User visits the application** - No automatic authentication occurs
2. **User clicks "Authorize with Certificate"** - Browser prompts for certificate selection
3. **mTLS authentication** - Certificate is used to obtain JWT token
4. **JWT token storage** - Token is stored in localStorage for persistence
5. **Automatic token refresh** - SDK handles token refresh 5 minutes before expiration
6. **Cross-tab synchronization** - Tokens work across multiple browser tabs

### Key Features

- **User-controlled authentication** - Users must explicitly login
- **JWT token management** - Automatic refresh and secure storage
- **Cross-tab synchronization** - Login state shared across browser tabs
- **Certificate-based security** - mTLS for initial authentication
- **Persistent sessions** - Users stay logged in across browser sessions

### User Profile Information

The JWT token contains user information that can be displayed in the UI:

- User UUID
- Authorities/roles
- Account status (enabled, locked, expired)
- Token expiration time

## Project Structure

```
src/
├── app/                # Next.js app router pages
│   ├── page.tsx       # Auth page
│   ├── objects/       # Objects management
│   └── help/          # Help documentation
├── components/        # React components
│   ├── ui/           # Shared UI components
│   └── ...           # Feature components
├── lib/              # Utilities
├── hooks/            # React hooks
├── contexts/         # React contexts
└── constants/        # Application constants
```

## Available Scripts

- `pnpm dev` - Start the development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check formatting with Prettier

## Configuration

### Docker Configuration

The application supports Docker deployment with runtime configuration:

- Environment variables are passed to the container at runtime
- The `/api/config` endpoint serves client-side configuration
- Single Docker image can be deployed to multiple environments
