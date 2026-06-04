import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Regression tests for the import job status lifecycle.
 *
 * Bug: a completed import job could be left with status "processing" forever
 * (with `completedAt` already set), which kept the import-status page spinning
 * indefinitely. The root cause was that the "processing" transition was written
 * by startProcessing() OUTSIDE processImportJob, so a re-entrant/duplicate
 * trigger could stamp "processing" back onto an already-completed job.
 *
 * The fix moves the "processing" write INSIDE processImportJob, after its
 * terminal-status guard, making the transition strictly ordered and the whole
 * function idempotent against duplicate triggers. These tests lock that in.
 */

// --- In-memory fake Redis -------------------------------------------------
// hsetWithTTL (the real implementation) runs against this, so we exercise the
// actual status writes rather than mocking them away.
const hashes = new Map<string, Record<string, string>>()
const strings = new Map<string, string>()

const fakeRedis = {
  ping: vi.fn(async () => 'PONG'),
  hgetall: vi.fn(async (key: string) => ({ ...(hashes.get(key) || {}) })),
  hset: vi.fn(
    async (
      key: string,
      fieldOrObject: string | Record<string, string | number>,
      value?: string | number
    ) => {
      const current = hashes.get(key) || {}
      if (typeof fieldOrObject === 'object') {
        for (const [k, v] of Object.entries(fieldOrObject)) {
          current[k] = String(v)
        }
      } else if (value !== undefined) {
        current[fieldOrObject] = String(value)
      }
      hashes.set(key, current)
      return 1
    }
  ),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => strings.get(key) ?? null),
  del: vi.fn(async (...keys: string[]) => {
    let removed = 0
    for (const key of keys) {
      if (hashes.delete(key)) removed++
      if (strings.delete(key)) removed++
    }
    return removed
  }),
}

vi.mock('@/lib/redis', () => ({
  getRedis: () => fakeRedis,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    import: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock('@/lib/security-utils', () => ({
  untrackUserJob: vi.fn(async () => undefined),
}))

vi.mock('@/lib/crypto-utils', () => ({
  // Identity decrypt so the stored "jwtToken" is treated as present/valid.
  decrypt: (value: string) => value,
}))

import { processImportJob } from '@/lib/import-processor'

const JOB_ID = 'job-1'
const JOB_KEY = `import:${JOB_ID}`

function seedPendingJob(objectCount = 2) {
  hashes.clear()
  strings.clear()

  hashes.set(JOB_KEY, {
    status: 'pending',
    userUUID: 'user-1',
    jwtToken: 'fake-jwt',
    createdAt: '1000',
    total: String(objectCount),
    processed: '0',
    failed: '0',
    totalChunks: '1',
  })

  const objects = Array.from({ length: objectCount }, (_, i) => ({
    id: `obj-${i}`,
    type: 'material',
  }))
  strings.set(`${JOB_KEY}:chunk:0`, JSON.stringify(objects))
}

describe('processImportJob status lifecycle', () => {
  const originalBaseUrl = process.env.BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BASE_URL = 'https://api.example.test'
    // Default: Node API accepts every batch.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async () => ({}),
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL
    } else {
      process.env.BASE_URL = originalBaseUrl
    }
  })

  it('transitions a pending job to completed with a completedAt timestamp', async () => {
    seedPendingJob(2)

    await processImportJob(JOB_ID)

    const job = hashes.get(JOB_KEY)!
    expect(job.status).toBe('completed')
    expect(job.processed).toBe('2')
    expect(job.failed).toBe('0')
    expect(job.completedAt).toBeDefined()
  })

  it('does NOT reset a completed job back to processing when triggered again (regression)', async () => {
    seedPendingJob(2)

    // First run completes the job.
    await processImportJob(JOB_ID)
    const afterFirst = hashes.get(JOB_KEY)!
    expect(afterFirst.status).toBe('completed')
    const completedAt = afterFirst.completedAt

    // A duplicate / re-entrant trigger must be a no-op: the terminal-status
    // guard short-circuits before any "processing" write happens.
    await processImportJob(JOB_ID)

    const afterSecond = hashes.get(JOB_KEY)!
    expect(afterSecond.status).toBe('completed')
    expect(afterSecond.completedAt).toBe(completedAt)
  })

  it('marks the job completed_with_errors when a batch fails', async () => {
    seedPendingJob(2)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: async () => ({ error: 'boom' }),
      }))
    )

    await processImportJob(JOB_ID)

    const job = hashes.get(JOB_KEY)!
    expect(job.status).toBe('completed_with_errors')
    expect(job.failed).toBe('2')
    expect(job.completedAt).toBeDefined()
  })
})
