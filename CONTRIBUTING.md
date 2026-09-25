# Contributing to io2p-ui

Thanks for taking an interest. This document covers what you need to get the project running and
what a change has to satisfy before it can be merged.

If you are reporting a security problem, **stop here** and read [SECURITY.md](SECURITY.md) instead —
those go through a private channel, not a pull request.

## Getting started

**Prerequisites:** Node.js 22 or newer (`.nvmrc` pins 24) and pnpm 11. `corepack enable` will pick
up the right pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev            # https://localhost:3000
```

This is a front end. It needs reachable `io2p-auth` and `io2p-core` instances for anything past the
login screen — point `.env` at them before you start. `BASE_URL` is the fallback for every service;
`AUTH_BASE_URL` and `CORE_BASE_URL` override it per service. `src/constants/client.ts` is the
authoritative list — read `buildRuntimeConfig()` there rather than trusting a doc.

## The gate

```bash
pnpm fullcheck
```

Note the name — it is **`fullcheck`**, not `verify` as in the other io2p repositories. That is
`typecheck` → `lint` → `format:check` → `test:run` → `build`, and **it must be green before every
commit**, not just before opening the PR.

If it fails on formatting, run `pnpm format`. There is no `lint:fix` script here; use
`pnpm exec eslint . --fix`.

End-to-end tests are separate and not in the gate:

```bash
pnpm test:e2e       # Playwright; needs the dev server running
```

## Things that will catch you out

**Every user-facing string needs a translation key in both `en.json` and `nl.json`.** A test asserts
the two files have identical key sets, so a key added to one and not the other fails CI. Never
hardcode English in a component.

**One of those keys is not covered by that test.** The footer builds its labels from a template
literal rather than a string constant, so the checker cannot see which key is actually needed. A
missing `nav.*` entry for a new footer link fails at render, in the browser, not in CI. Add it
deliberately.

**Every route segment needs `loading.tsx` and `error.tsx`.** Copy `error.tsx` verbatim from
`src/app/error.tsx` — `src/app/settings/error.tsx` is a byte-identical copy and that is the
convention, not laziness.

**A new public page must be registered in `PUBLIC_PAGES`** (`src/constants/auth.ts`). That one array
feeds three consumers: the proxy's auth gate, the auth context's client-side redirect, and the
layout's decision about whether to render the navbar and footer. Miss it and the page redirects
logged-out visitors to the login screen. Note that a public page renders **chromeless** — no navbar,
no footer — so it must supply its own way back, as `/help` and `/security` do.

**Never use `console.log`.** Use `logger` from `@/lib/observability/logger`. In production the
browser console is off by design and records ship to `/api/telemetry`; a `console.*` call is simply
invisible where it matters.

`AGENTS.md` is the full reference for these conventions — data fetching via React Query only, `cn()`
for class names, lazy-loading heavy components, and the rules for API-route protection tiers. Read
it before a first substantial change.

## A note on CI

`.github/workflows/ci.yml` is currently **`workflow_dispatch` only — deliberately dormant.** The
steps are correct, but `io2p-client` is consumed as a `file:` dependency that a GitHub runner cannot
resolve. Until that is fixed, `pnpm fullcheck` on your machine is the only gate, which makes running
it non-optional.

## Branches and commits

Branch off `dev`, name it `feat/<slug>` or `fix/<slug>`, and open the PR against `dev`. `main` is
the release branch.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`,
`tweak:`, `refactor:`, `style:`, `docs:`, `chore:`.

**Phase the work.** Each commit should build green on its own and be reviewable on its own.

Do not bypass the pre-commit hook with `--no-verify` unless you have a specific reason and say what
it was — it runs ESLint, Prettier, and a typecheck on staged files, plus a secret scan.

## Pull requests

Use the template — note its checklist item is `pnpm fullcheck`. For a UI change, say what you
verified in a browser; a passing build says nothing about whether the thing renders.

There is no CLA and no sign-off requirement. Contributions are accepted under the MIT license the
project ships under — see [LICENSE](LICENSE).

## Where to ask

- **A bug or a concrete proposal** → open an issue using the templates.
- **A security problem** → [SECURITY.md](SECURITY.md), never a public issue.
- **Anything else** → `info@maeconomy.org`.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
