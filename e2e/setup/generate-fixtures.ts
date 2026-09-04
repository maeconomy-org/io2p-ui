import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Write the generated fixtures before anything reads one.
 *
 * They are gitignored binaries — `oversize.csv`, `huge.csv`, `many.csv`, the two workbooks and the
 * upload set — and `pretest:e2e` only builds them for `pnpm test:e2e`. A bare `npx playwright test`
 * skips that hook, which is the command the plan's own run instructions give: six specs then fail
 * with `ENOENT`, in the `read` project, which cancels `write` and its 255 tests.
 *
 * Cheap to repeat — the generator rewrites a file only when it is missing or the wrong size.
 * Spawned rather than imported: it calls `process.exit(1)` on failure, and that would take
 * Playwright down mid-report instead of reporting the error.
 */
export default function generateFixtures(): void {
  // Resolved against THIS FILE, not `process.cwd()`. Playwright resolves the `globalSetup` value
  // relative to the config, but the cwd is wherever the shell happened to be — so a run started
  // from `e2e/`, or from a monorepo root with `--config`, would ENOENT on a path naming the wrong
  // layer. Which is the exact report this file exists to stop producing.
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../fixtures/generate.mjs', import.meta.url))],
    { stdio: 'inherit' }
  )
}
