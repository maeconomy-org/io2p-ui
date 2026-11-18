import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

import { expect, test as check } from '@playwright/test'

/**
 * The services and the build every spec depends on, checked before the sign-in.
 *
 * Without this a dead core worker fails thirty specs one by one: the API accepts every write, and
 * the derived values (child counts, ancestors, totals) never appear. A stale build passes every
 * other check and tests code that is no longer in the tree.
 */
const CORE = process.env.CORE_BASE_URL || 'http://localhost:8080'
const WORKER = process.env.E2E_WORKER_HEALTH_URL || 'http://localhost:8082'
const STAMP_FILE = '.next/standalone/e2e-build.json'

async function health(url: string): Promise<string> {
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok ? 'ok' : `HTTP ${res.status}`
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

check('core API and worker answer', async () => {
  expect(
    await health(CORE),
    `The core API at ${CORE} does not answer. Start it in io2p-core (pnpm run dev).`
  ).toBe('ok')
  expect(
    await health(WORKER),
    `The core worker at ${WORKER} does not answer. Start it in io2p-core (pnpm run worker); ` +
      'without it child counts, ancestors and totals never appear.'
  ).toBe('ok')
})

check('the build is made from this tree', async () => {
  // A reused server (E2E_REUSE) may not be the standalone build; `00-harness/build` checks it.
  check.skip(
    !!process.env.E2E_REUSE,
    'E2E_REUSE: the server was not started from this build'
  )

  expect(
    existsSync(STAMP_FILE),
    `${STAMP_FILE} is missing. Run pnpm run build:e2e.`
  ).toBe(true)
  const built = JSON.parse(readFileSync(STAMP_FILE, 'utf8'))
  const tree = JSON.parse(
    execFileSync('node', ['e2e/setup/build-stamp.mjs', '--print'], {
      encoding: 'utf8',
    })
  )
  expect(
    built,
    'The build is not from this tree (commit or tracked changes differ; new untracked files ' +
      'are not checked). Run pnpm run build:e2e again.'
  ).toEqual(tree)
})
