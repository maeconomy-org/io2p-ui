import type { Page, Route } from '@playwright/test'

/**
 * Routes intercepted by `installFileStorageMock`. Mirrors the iom-sdk
 * `FileStorageServiceClient` path constants — keep in sync with
 * iom-sdk/src/services/fileStorage/file-storage-client.ts.
 */
const ROUTE = {
  init: '**/api/FileStorage/init',
  refresh: '**/api/FileStorage/*/refresh',
  complete: '**/api/FileStorage/*/complete',
  abort: '**/api/FileStorage/*', // DELETE — same path as metadata GET, method discriminates
  preview: '**/api/FileStorage/*/preview-url',
  softDelete: '**/api/FileStorage/*/delete',
  presignedPart: 'https://mock-s3.test/upload/**',
} as const

export type MockFileStorageOptions = {
  /** Delay before `init` resolves. Use to widen the cancel-during-hash window. */
  initDelayMs?: number
  /** Total parts to advertise on `init`. Default 1 (single-part). */
  parts?: number
  /**
   * Part numbers that should 503 once before succeeding on retry. The SDK's
   * default `PER_PART_MAX_RETRIES = 3` is enough to survive a single failure.
   */
  partFailures?: number[]
  /** Override response status for `complete`. Default 200. */
  completeStatus?: number
  /** TTL embedded in `init` and `preview` responses. Default 900s. */
  presignedTTLSeconds?: number
  /** If true, the abort DELETE returns 503 (used to test the watchdog). */
  abortHangs?: boolean
  /** Override response body for `preview-url`. */
  previewUrl?: string
}

type MockState = {
  initCount: number
  completeCount: number
  abortCount: number
  partAttempts: Map<number, number>
  partFailures: Set<number>
  uploadId: string
  fileReference: string
}

/**
 * Install a mock for every `**\/api/FileStorage/*` endpoint plus the
 * presigned part-upload URLs we hand out. Call once per test, before the
 * page navigates to anything that triggers the upload service.
 *
 * Returns a `state` object the test can read to assert call counts (e.g.
 * "abort was called exactly once") and a `partUrl(n)` helper to query the
 * presigned URL the mock issued for a given part.
 */
export function installFileStorageMock(
  page: Page,
  opts: MockFileStorageOptions = {}
) {
  const {
    initDelayMs = 0,
    parts = 1,
    partFailures = [],
    completeStatus = 200,
    presignedTTLSeconds = 900,
    abortHangs = false,
    previewUrl = 'https://mock-s3.test/preview/file.bin?X-Amz-Signature=mock',
  } = opts

  const state: MockState = {
    initCount: 0,
    completeCount: 0,
    abortCount: 0,
    partAttempts: new Map(),
    partFailures: new Set(partFailures),
    uploadId: 'mock-upload-' + Math.random().toString(36).slice(2),
    fileReference: 'mock-file-' + Math.random().toString(36).slice(2),
  }

  const expiresAt = () =>
    new Date(Date.now() + presignedTTLSeconds * 1000).toISOString()

  const partUrl = (n: number) =>
    `https://mock-s3.test/upload/${state.uploadId}/part-${n}`

  const routes: Array<{ url: string; handler: (route: Route) => unknown }> = [
    {
      url: ROUTE.init,
      handler: async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        state.initCount += 1
        if (initDelayMs > 0) {
          await new Promise((r) => setTimeout(r, initDelayMs))
        }
        const urls = Array.from({ length: parts }, (_, i) => partUrl(i + 1))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadId: state.uploadId,
            fileReference: state.fileReference,
            urls,
            partSize: parts === 1 ? null : 8 * 1024 * 1024,
            expiresAt: expiresAt(),
          }),
        })
      },
    },
    {
      url: ROUTE.refresh,
      handler: (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        const urls = Array.from({ length: parts }, (_, i) => partUrl(i + 1))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadId: state.uploadId,
            fileReference: state.fileReference,
            urls,
            partSize: parts === 1 ? null : 8 * 1024 * 1024,
            expiresAt: expiresAt(),
          }),
        })
      },
    },
    {
      url: ROUTE.complete,
      handler: (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        state.completeCount += 1
        return route.fulfill({
          status: completeStatus,
          contentType: 'application/json',
          body: JSON.stringify({
            fileReference: state.fileReference,
            size: 0,
            mimeType: 'application/octet-stream',
          }),
        })
      },
    },
    {
      url: ROUTE.preview,
      handler: (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: previewUrl, expiresAt: expiresAt() }),
        })
      },
    },
    {
      url: ROUTE.softDelete,
      handler: (route) => {
        if (route.request().method() !== 'DELETE') return route.fallback()
        return route.fulfill({ status: 204 })
      },
    },
    {
      // DELETE on the bare uploadId path is the abort; GET is metadata.
      // The softDelete route above already claims /delete suffix, so this
      // matches only the bare DELETE.
      url: ROUTE.abort,
      handler: async (route) => {
        const method = route.request().method()
        if (method !== 'DELETE') return route.fallback()
        state.abortCount += 1
        if (abortHangs) {
          // Park the response so the watchdog tests can observe the hang.
          await new Promise((r) => setTimeout(r, 30_000))
          return route.fulfill({ status: 503 })
        }
        return route.fulfill({ status: 204 })
      },
    },
    {
      url: ROUTE.presignedPart,
      handler: (route) => {
        const method = route.request().method()
        // Mock URL is cross-origin (mock-s3.test ≠ localhost:3000), so the
        // browser sends a CORS preflight before the PUT and hides response
        // headers from JS unless we explicitly expose them. Mirror the headers
        // a CORS-configured S3 bucket would return.
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, DELETE, GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Expose-Headers': 'ETag',
        }
        if (method === 'OPTIONS') {
          return route.fulfill({ status: 204, headers: corsHeaders })
        }
        if (method !== 'PUT') return route.fallback()
        const url = new URL(route.request().url())
        const partMatch = url.pathname.match(/part-(\d+)$/)
        const partNumber = partMatch ? parseInt(partMatch[1], 10) : 1

        const attempt = (state.partAttempts.get(partNumber) ?? 0) + 1
        state.partAttempts.set(partNumber, attempt)

        if (state.partFailures.has(partNumber) && attempt === 1) {
          return route.fulfill({ status: 503, headers: corsHeaders })
        }
        return route.fulfill({
          status: 200,
          headers: { ...corsHeaders, ETag: `"etag-${partNumber}"` },
        })
      },
    },
  ]

  return Promise.all(
    routes.map(({ url, handler }) => page.route(url, handler))
  ).then(() => ({
    state,
    partUrl,
    /** Wait for the next call to `complete`. Resolves to the request body. */
    async waitForComplete() {
      const req = await page.waitForRequest(
        (r) =>
          r.method() === 'POST' &&
          /\/api\/FileStorage\/.+\/complete$/.test(r.url())
      )
      return JSON.parse(req.postData() ?? '{}')
    },
    /** Wait for the next call to `abort`. */
    waitForAbort() {
      return page.waitForRequest(
        (r) =>
          r.method() === 'DELETE' &&
          /\/api\/FileStorage\/[^/]+$/.test(r.url()) &&
          !r.url().endsWith('/delete')
      )
    },
  }))
}
