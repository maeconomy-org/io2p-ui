import { expect, type Page, test as base } from '@playwright/test'

export interface RecordedRequest {
  method: string
  url: string
  /** Path + search only, so an assertion is not coupled to the port. */
  path: string
}

export class ApiRecorder {
  private readonly requests: RecordedRequest[] = []

  /** @internal — driven by the fixture. */
  record(request: RecordedRequest): void {
    this.requests.push(request)
  }

  matching(pattern: RegExp): RecordedRequest[] {
    return this.requests.filter((request) => pattern.test(request.path))
  }

  /** Matches the full URL, host included — for bytes going straight to S3 rather than the node. */
  matchingUrl(pattern: RegExp): RecordedRequest[] {
    return this.requests.filter((request) => pattern.test(request.url))
  }

  count(pattern: RegExp): number {
    return this.matching(pattern).length
  }

  /** Polls: a request fired on click has not necessarily left by the time the click resolves. */
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

const IGNORED_CONSOLE = [
  // Transport failures before any app code runs — a proxy or DNS blocker refusing the dev
  // server's own chunk requests, which `next dev` then reports as a ChunkLoadError.
  /net::ERR_/,
  /ChunkLoadError/,
  /query-devtools/,
]

/**
 * Attach the console and pageerror listeners to ANY page, and hand back the array they fill.
 *
 * Exported because a spec that opens its own context — a cold tab, a second account — gets no
 * `consoleGuard`, and a second hand-rolled collector drifts from this one in both directions at
 * once: stricter, because it drops `IGNORED_CONSOLE` and goes red on a chunk request the fixture
 * exists to ignore; weaker, because it drops the `MISSING_MESSAGE` matching that is the whole
 * reason the guard reads warnings at all.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  const keep = (text: string) =>
    !IGNORED_CONSOLE.some((pattern) => pattern.test(text))

  page.on('console', (message) => {
    const text = message.text()
    // MISSING_MESSAGE is a next-intl WARNING, so the type alone would miss the likeliest i18n
    // failure: a key in en.json and not in nl.json.
    if (
      (message.type() === 'error' || /MISSING_MESSAGE/.test(text)) &&
      keep(text)
    ) {
      errors.push(text)
    }
  })

  page.on('pageerror', (error) => {
    if (keep(error.message)) errors.push(`pageerror: ${error.message}`)
  })

  return errors
}

/** Lets a test declare an error it expects — a missing route SHOULD 404. */
export interface ConsoleGuard {
  expectError(pattern: RegExp): void
}

export const test = base.extend<{
  consoleGuard: ConsoleGuard
  api: ApiRecorder
}>({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      // The same collector every spec with its own context uses, so the shared path is the one
      // proven by the whole suite rather than by the handful of specs that open a second page.
      const errors = collectConsoleErrors(page)
      const expected: RegExp[] = []

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
