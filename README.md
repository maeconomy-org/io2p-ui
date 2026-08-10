# io2p-ui

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

The web application for [io2p](https://io2p.org) — the Internet of Objects Protocol.

## What this is

io2p gives real-world objects a durable digital identity: an append-only, hash-chained record of
what a thing is, what it is made of, and everything that has happened to it. The protocol itself is
storage and transport; this repository is the interface people actually use to work with it.

It is built for tracking physical materials through their whole life — a building's components from
manufacture through installation, renovation, demolition, and reuse. Hence the emphasis you will
find throughout on hierarchy (a building contains floors contain rooms contain components),
provenance (who recorded what, and when), and processes (what turned these inputs into those
outputs).

**Why a separate repository:** io2p is meant to be implementable by anyone. Keeping the protocol
(`io2p-core`) apart from one particular interface to it is what makes that claim real rather than
aspirational — this application is _an_ io2p client, not _the_ io2p.

## The rest of the project

| Repository                                                                | What it is                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [io2p-core](https://github.com/maeconomy-org/io2p-core)                   | The storage node — event-sourced, hash-chained, one REST API |
| [io2p-auth](https://github.com/maeconomy-org/io2p-auth)                   | Token issuance and JWKS publication                          |
| [io2p-client](https://github.com/maeconomy-org/io2p-client)               | TypeScript client library — what this app talks through      |
| [io2p-ui](https://github.com/maeconomy-org/io2p-ui)                       | **This repository**                                          |
| [io2p-auth-admin-ui](https://github.com/maeconomy-org/io2p-auth-admin-ui) | Administrative interface for `io2p-auth`                     |
| [io2p-iac](https://github.com/maeconomy-org/io2p-iac)                     | Terraform to deploy a node into your own Azure subscription  |
| [io2p-website](https://github.com/maeconomy-org/io2p-website)             | The source of io2p.org                                       |

## What it does

- **Objects** — hierarchical structures (building → floor → room → component) with typed properties,
  files, and relationships between them
- **Processes** — record what consumed which inputs and produced which outputs, so material flow is
  traceable in both directions
- **Templates, formulas, and constants** — reusable models so recurring structures are described
  once rather than re-entered
- **Bulk import** — CSV and Excel, with a wizard that validates before it commits and a job list
  that reports what actually landed
- **Sharing and access** — grant reach over a subtree rather than object by object
- **English and Dutch** throughout

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS + Radix (shadcn/ui) · TanStack Query
v5 · React Hook Form + Zod · ECharts · next-intl · Playwright + Vitest.

Authentication is mTLS client certificates or email/password, issued as JWTs by `io2p-auth`. Error
tracking is browser-only Sentry, tunnelled through `/monitoring`; server-side observability is
structured NDJSON logging with optional OpenTelemetry.

## Getting started

**Prerequisites:** Node.js 22 or newer, pnpm 11 (`corepack enable`), and a reachable `io2p-auth` and
`io2p-core`.

```bash
git clone https://github.com/maeconomy-org/io2p-ui.git
cd io2p-ui
pnpm install
cp .env.example .env
pnpm dev            # https://localhost:3000
```

`BASE_URL` is the fallback for every service; `AUTH_BASE_URL` and `CORE_BASE_URL` override it per
service. `buildRuntimeConfig()` in `src/constants/client.ts` is the authoritative list of every
variable the browser can see.

### Configuration is read at runtime, not at build time

No environment variable is baked into the bundle, so **one Docker image runs in every environment**.
Values reach the browser two ways, both from the same `buildRuntimeConfig()` source: an inline
`<script>` in `layout.tsx` on first paint (no network request), and `/api/config` thereafter, cached
in localStorage for 24 hours.

The practical consequence for contributors: a bare `process.env.X` read in client code compiles away
to nothing and silently does something other than what you intended. New browser-visible config goes
through `buildRuntimeConfig()`.

## Development

```bash
pnpm dev            # dev server
pnpm fullcheck      # THE GATE — typecheck + lint + format:check + test + build
pnpm test           # vitest, watch mode
pnpm test:e2e       # Playwright (needs the dev server running)
```

`pnpm fullcheck` must be green before every commit. Note the name — the other io2p repositories call
their equivalent `pnpm verify`.

> **CI is currently dormant here.** `.github/workflows/ci.yml` is `workflow_dispatch` only, because
> `io2p-client` is consumed as a `file:` dependency that a GitHub runner cannot resolve. The steps
> are correct and ready; only the triggers are withheld. Until that is fixed, the local gate is the
> only gate, so running it is not optional. CodeQL and dependency review do run on every PR —
> neither needs a dependency install.

## Project structure

```
src/
├── app/          # routes — each owns page.tsx, loading.tsx, error.tsx, and its own components/
├── components/   # shared UI: ui/ (shadcn) · shell/ · entity-list/ · entity-sheet/ · dialogs/ · …
├── constants/    # static config, nav items, enums
├── contexts/     # React context providers
├── hooks/        # api/ (React Query) · data/ · drafts/ · ui/
├── lib/          # cross-cutting only: auth/ · http/ · entity/ · observability/ · …
├── messages/     # en.json, nl.json
└── types/        # shared TypeScript types
```

Feature-specific code lives with its feature, not in `lib/`. `AGENTS.md` is the full architectural
reference and the house rules — read it before a first substantial change.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the gate, the branch model, and the handful of
conventions that will otherwise catch you out. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

**Do not report vulnerabilities in a public issue.** See [SECURITY.md](SECURITY.md) for the private
channels, scope, and our safe-harbour terms — or <https://io2p.org/security>.

## License

MIT — see [LICENSE](LICENSE).
