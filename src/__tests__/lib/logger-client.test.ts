// Browser sink behavior: console gating (prod dark, localStorage opt-in) and
// the Sentry sink capturing the REAL exception.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const captureException = vi.fn()
const captureMessage = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

function setIomConfig(config: Record<string, unknown> | undefined) {
  ;(window as unknown as Record<string, unknown>).__IOM_CONFIG__ = config
}

describe('client sinks', () => {
  beforeEach(() => {
    vi.resetModules()
    captureException.mockClear()
    captureMessage.mockClear()
    window.localStorage.clear()
    setIomConfig(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('consoleThreshold', () => {
    it('defaults to info outside production', async () => {
      const { consoleThreshold } = await import('@/lib/logger/client')
      expect(consoleThreshold()).toBe('info')
    })

    it('reads config.logLevel from __IOM_CONFIG__ outside production', async () => {
      setIomConfig({ baseUrl: 'https://x', logLevel: 'debug' })
      const { consoleThreshold } = await import('@/lib/logger/client')
      expect(consoleThreshold()).toBe('debug')
    })

    it('falls back when config.logLevel is a typo', async () => {
      setIomConfig({ baseUrl: 'https://x', logLevel: 'debgu' })
      const { consoleThreshold } = await import('@/lib/logger/client')
      expect(consoleThreshold()).toBe('info')
    })

    it('is OFF in production without the localStorage override', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { consoleThreshold } = await import('@/lib/logger/client')
      expect(consoleThreshold()).toBe('off')
    })

    it('honours the localStorage escape hatch in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      window.localStorage.setItem('iom:log-level', 'debug')
      const { consoleThreshold } = await import('@/lib/logger/client')
      expect(consoleThreshold()).toBe('debug')
    })
  })

  describe('shipThreshold', () => {
    it('is off by default outside production', async () => {
      const { shipThreshold } = await import('@/lib/logger/client')
      expect(shipThreshold()).toBe('off')
    })

    it('honours an explicit config.logShipLevel anywhere', async () => {
      setIomConfig({ baseUrl: 'https://x', logShipLevel: 'debug' })
      const { shipThreshold } = await import('@/lib/logger/client')
      expect(shipThreshold()).toBe('debug')
    })

    it('defaults to info in production (ship sink ON by design)', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { shipThreshold } = await import('@/lib/logger/client')
      expect(shipThreshold()).toBe('info')
    })
  })

  describe('sentrySink', () => {
    it('captures the REAL error object, never a fabricated one', async () => {
      const { sentrySink } = await import('@/lib/logger/client')
      const { buildRecord } = await import('@/lib/logger/core')
      const error = new Error('the real one')
      sentrySink.write(buildRecord('error', 'Save failed', { err: error }))

      expect(captureException).toHaveBeenCalledTimes(1)
      const [captured, opts] = captureException.mock.calls[0] as [
        unknown,
        { extra: Record<string, unknown> },
      ]
      // Identity, not equality: the sink must pass the original instance so
      // Sentry groups by ITS stack, not by logger frames.
      expect(captured).toBe(error)
      expect(opts.extra.message).toBe('Save failed')
      expect(captureMessage).not.toHaveBeenCalled()
    })

    it('uses captureMessage when there is genuinely no error', async () => {
      const { sentrySink } = await import('@/lib/logger/client')
      const { buildRecord } = await import('@/lib/logger/core')
      sentrySink.write(buildRecord('error', 'No throwable here', { id: 1 }))
      expect(captureMessage).toHaveBeenCalledTimes(1)
      expect(captureMessage.mock.calls[0][0]).toBe('No throwable here')
      expect(captureException).not.toHaveBeenCalled()
    })
  })

  describe('consoleSink', () => {
    it('passes the real Error as its own console argument', async () => {
      const { consoleSink } = await import('@/lib/logger/client')
      const { buildRecord } = await import('@/lib/logger/core')
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('render me natively')
      consoleSink.write(buildRecord('error', 'Boundary hit', { err: error }))
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]).toContain(error)
      spy.mockRestore()
    })
  })
})
