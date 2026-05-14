import { describe, it, expect, vi, afterEach } from 'vitest'

import { installTestHooks } from '@/lib/test-hooks'

function stubService() {
  return {
    setMaxConcurrent: vi.fn(),
    forceWatchdog: vi.fn(),
    getTask: vi.fn().mockReturnValue({ id: 't', status: 'pending' }),
    getAllTasks: vi.fn().mockReturnValue([{ id: 't' }]),
  } as any
}

function stubQueryClient() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as any
}

afterEach(() => {
  delete (window as any).__testHooks
  vi.unstubAllEnvs()
})

describe('installTestHooks', () => {
  it('exposes a narrow uploadService + queryClient surface on window', () => {
    const service = stubService()
    const qc = stubQueryClient()

    installTestHooks(service, qc)

    expect(window.__testHooks).toBeDefined()
    window.__testHooks!.uploadService.setMaxConcurrent(2)
    expect(service.setMaxConcurrent).toHaveBeenCalledWith(2)

    window.__testHooks!.uploadService.forceWatchdog('abc')
    expect(service.forceWatchdog).toHaveBeenCalledWith('abc')

    window.__testHooks!.queryClient.invalidate(['files', 'preview', '1'])
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['files', 'preview', '1'],
    })
  })

  it('returns a cleanup that removes the global', () => {
    const cleanup = installTestHooks(stubService(), stubQueryClient())
    expect(window.__testHooks).toBeDefined()
    cleanup()
    expect(window.__testHooks).toBeUndefined()
  })

  it('is a no-op in production NODE_ENV — global is never set', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const cleanup = installTestHooks(stubService(), stubQueryClient())
    expect(window.__testHooks).toBeUndefined()
    // Cleanup is still callable and safe.
    expect(() => cleanup()).not.toThrow()
  })
})
