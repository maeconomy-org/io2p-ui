import { expect, test as base } from '@playwright/test'

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
  // A request CANCELLED by navigation, not one that failed: `reload()` and `goto()` abort what is
  // in flight and io2p-client logs that at error level. Narrow enough that a real 4xx still fails.
  /io2p request failed[\s\S]*status: undefined[\s\S]*(Failed to fetch|NetworkError)/,
]

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
      const errors: string[] = []
      const expected: RegExp[] = []
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
