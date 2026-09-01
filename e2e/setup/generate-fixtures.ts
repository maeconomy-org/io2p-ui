import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

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
  execFileSync(
    process.execPath,
    [resolve(process.cwd(), 'e2e/fixtures/generate.mjs')],
    { stdio: 'inherit' }
  )
}
