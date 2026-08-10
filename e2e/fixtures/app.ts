/**
 * The base `test` every spec imports instead of `@playwright/test`.
 *
 * Both fixtures exist for the same reason: this branch's bugs are not crashes, they are controls
 * that run and do nothing. A click succeeds, a screenshot looks right, and the request was never
 * sent — the `5df2f1c` template regression shipped green through typecheck, lint, 972 unit tests
 * and a build. Neither a click nor a screenshot catches that; a request log does.
 */

import { expect, test as base } from '@playwright/test'

export interface RecordedRequest {
  method: string
  url: string
  /** Path + search only. Comparing full URLs couples every assertion to the port. */
  path: string
}

export class ApiRecorder {
  private readonly requests: RecordedRequest[] = []

  /** @internal — driven by the fixture. */
  record(request: RecordedRequest): void {
    this.requests.push(request)
  }

  /** Every request whose path matches, in order. */
  matching(pattern: RegExp): RecordedRequest[] {
    return this.requests.filter((request) => pattern.test(request.path))
  }

  count(pattern: RegExp): number {
    return this.matching(pattern).length
  }

  /**
   * Waits for the count to settle rather than reading it immediately: a request the UI fires on
   * click has not necessarily left by the time the click resolves, so a bare `count()` races and
   * reports 0 for a request that was about to happen.
   */
  async expectCount(pattern: RegExp, expected: number): Promise<void> {
    await expect
      .poll(() => this.count(pattern), {
        message: `requests matching ${pattern}`,
      })
      .toBe(expected)
  }

  clear(): void {
    this.requests.length = 0
  }
}

/**
 * Console output the guard ignores. Deliberately SHORT and each entry justified — a guard that
 * fails on environment noise gets switched off, and a switched-off guard is worse than none.
 *
 * Nothing here may match app code. If a future entry would, the fix belongs in the app.
 */
const IGNORED_CONSOLE = [
  // A transport failure, not the app: behind a proxy or a DNS blocker the dev server's own chunk
  // requests fail before any application code runs.
  /net::ERR_/,
  // Follows the above. `next dev` code-splits per module, so one blocked fetch surfaces as a
  // ChunkLoadError for whatever was lazy at that moment. A production build serves these
  // statically and does not produce it.
  /ChunkLoadError/,
  // The React Query devtools are dev-only and are not in the shipped bundle at all.
  /query-devtools/,
  // A request CANCELLED by navigation, not a request that failed.
  //
  // `page.reload()` and `page.goto()` abort whatever was in flight, and the browser reports that to
  // the caller as `TypeError: Failed to fetch` / `NetworkError` with no status — which io2p-client
  // logs at error level. Any spec that reloads therefore manufactures its own console errors, and
  // three already did.
  //
  // Safe to ignore here because it is not the signal these tests rely on: a node that is genuinely
  // unreachable fails them on missing content long before the log matters. It is narrow — it
  // requires io2p-client's own prefix AND a status-less failure, so a real 4xx or 5xx still fails
  // the guard.
  //
  // Worth noting beyond the suite: the same log fires in production whenever a user navigates
  // during a fetch, and error-level records go to Sentry.
  /io2p request failed[\s\S]*status: undefined[\s\S]*(Failed to fetch|NetworkError)/,
]

/**
 * Lets a test declare an error it EXPECTS.
 *
 * Some correct behaviour logs to the console: navigating to a route that does not exist should
 * produce a 404. Without this the only ways to keep such a test green are to widen the module-level
 * ignore list — which then hides real 404s everywhere — or to drop the guard for that file. Both
 * trade a permanent hole for a local problem.
 */
export interface ConsoleGuard {
  expectError(pattern: RegExp): void
}

export const test = base.extend<{
  consoleGuard: ConsoleGuard
  api: ApiRecorder
}>({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      const expected: RegExp[] = []
      const keep = (text: string) =>
        !IGNORED_CONSOLE.some((pattern) => pattern.test(text))

      page.on('console', (message) => {
        const text = message.text()
        // `MISSING_MESSAGE` is a next-intl warning, not an error, so the type check alone misses
        // the single most likely i18n failure — a key in en.json and not in nl.json.
        if (
          (message.type() === 'error' || /MISSING_MESSAGE/.test(text)) &&
          keep(text)
        ) {
          errors.push(text)
        }
      })

      // A page error is an uncaught exception; the console listener above never sees it.
      page.on('pageerror', (error) => {
        if (keep(error.message)) errors.push(`pageerror: ${error.message}`)
      })

      await use({
        expectError: (pattern) => expected.push(pattern),
      })

      const unexpected = errors.filter(
        (text) => !expected.some((pattern) => pattern.test(text))
      )
      expect(unexpected, `console errors during "${testInfo.title}"`).toEqual(
        []
      )
    },
    { auto: true },
  ],

  api: async ({ page }, use) => {
    const recorder = new ApiRecorder()

    page.on('request', (request) => {
      const url = new URL(request.url())
      recorder.record({
        method: request.method(),
        url: request.url(),
        path: `${url.pathname}${url.search}`,
      })
    })

    await use(recorder)
  },
})

export { expect } from '@playwright/test'
