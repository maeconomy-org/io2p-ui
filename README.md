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

3. Setup HTTPS certificates

4. Start the development server

   ```bash
   pnpm dev
   ```

5. Open your browser
   Navigate to `https://localhost:3000`

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
