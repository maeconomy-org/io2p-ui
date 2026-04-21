import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import type { FileUploadTask } from '@/lib/upload-service'

// ─── Mock the service hook so we can drive subscribe callbacks manually ──

const subscribers = new Set<() => void>()
let tasks: FileUploadTask[] = []
const mockQueueFileUploadsWithContext = vi.fn()
const mockClearCompleted = vi.fn()

function getAllTasks() {
  return tasks.slice()
}

function getUploadSummary() {
  return {
    completed: tasks.filter((t) => t.status === 'completed'),
    failed: tasks.filter((t) => t.status === 'failed'),
    pending: tasks.filter((t) => t.status === 'pending'),
    uploading: tasks.filter((t) => t.status === 'uploading'),
    total: tasks.length,
  }
}

function notify() {
  subscribers.forEach((fn) => fn())
}

const mockService = {
  subscribe: (listener: () => void) => {
    subscribers.add(listener)
    return () => {
      subscribers.delete(listener)
    }
  },
  getAllTasks,
  getUploadSummary,
  queueFileUploadsWithContext: mockQueueFileUploadsWithContext,
  clearCompleted: mockClearCompleted,
}

vi.mock('@/lib/upload-service', () => ({
  useUploadService: () => mockService,
}))

// ─── Mock next-intl ──

vi.mock('next-intl', () => ({
  useTranslations: () => (_key: string, values?: Record<string, unknown>) =>
    values ? `tr:${_key}:${JSON.stringify(values)}` : `tr:${_key}`,
}))

// ─── Mock sonner toast and logger so we can assert calls ──
// vi.mock factories are hoisted to the top of the file, so we can't reference
// outer-scope variables. Define spies lazily inside the mock and re-export.

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Import AFTER mocks so we pick up the mocked exports.
import { toast } from 'sonner'
import { logger } from '@/lib'

// Import AFTER mocks are set up.
import {
  UploadProvider,
  useUploadQueue,
  useOptionalUploadQueue,
} from '@/contexts/upload-context'

// Typed handles to the mocked functions.
const toastMock = toast as unknown as {
  loading: ReturnType<typeof vi.fn>
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}
const loggerMock = logger as unknown as {
  error: ReturnType<typeof vi.fn>
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
}

// ─── Helpers ──

function makeTask(overrides: Partial<FileUploadTask> = {}): FileUploadTask {
  return {
    id: overrides.id ?? 'task-1',
    attachment: { mode: 'upload', fileName: 'doc.pdf' } as any,
    objectUuid: 'obj-1',
    status: 'pending',
    progress: 0,
    retries: 0,
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={qc}>
      <UploadProvider>{children}</UploadProvider>
    </QueryClientProvider>
  )
}

// ─── Tests ──

describe('UploadProvider', () => {
  beforeEach(() => {
    subscribers.clear()
    tasks = []
    mockQueueFileUploadsWithContext.mockReset()
    mockClearCompleted.mockReset()
    toastMock.loading.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    loggerMock.error.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initial tasks reflect service.getAllTasks()', () => {
    tasks = [makeTask({ id: 'seed', status: 'completed', progress: 100 })]

    const { result } = renderHook(() => useUploadQueue(), { wrapper })

    expect(result.current.tasks.map((t) => t.id)).toEqual(['seed'])
    expect(result.current.summary.completed).toBe(1)
    expect(result.current.isIdle).toBe(true)
  })

  it('invalidates aggregates + objects query keys on completed task', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>
        <UploadProvider>{children}</UploadProvider>
      </QueryClientProvider>
    )

    tasks = [makeTask({ id: 'in-progress', status: 'uploading' })]
    renderHook(() => useUploadQueue(), { wrapper: localWrapper })

    // Now transition the task to completed and notify.
    act(() => {
      tasks = [
        makeTask({ id: 'in-progress', status: 'completed', progress: 100 }),
      ]
      notify()
    })

    // Both aggregates.detail and objects.detail should be invalidated.
    const calls = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['aggregates']),
        expect.arrayContaining(['objects']),
      ])
    )
  })

  it('does not double-invalidate on repeated notify for the same task', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>
        <UploadProvider>{children}</UploadProvider>
      </QueryClientProvider>
    )

    tasks = [makeTask({ id: 'x', status: 'uploading' })]
    renderHook(() => useUploadQueue(), { wrapper: localWrapper })

    act(() => {
      tasks = [makeTask({ id: 'x', status: 'completed', progress: 100 })]
      notify()
    })
    const afterFirst = invalidateSpy.mock.calls.length
    expect(afterFirst).toBeGreaterThan(0)

    act(() => {
      notify()
      notify()
    })

    expect(invalidateSpy.mock.calls.length).toBe(afterFirst)
  })

  it('logs via logger.error when a task transitions to failed', () => {
    tasks = [makeTask({ id: 'needs-fail', status: 'uploading' })]
    renderHook(() => useUploadQueue(), { wrapper })

    act(() => {
      tasks = [
        makeTask({
          id: 'needs-fail',
          status: 'failed',
          error: 'boom',
        }),
      ]
      notify()
    })

    expect(logger.error).toHaveBeenCalledWith(
      'Upload failed',
      expect.objectContaining({ id: 'needs-fail', error: 'boom' })
    )
  })

  describe('beforeunload guard', () => {
    it('does not register a handler while idle', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      renderHook(() => useUploadQueue(), { wrapper })

      expect(addSpy.mock.calls.some(([evt]) => evt === 'beforeunload')).toBe(
        false
      )
    })

    it('registers + removes handler across pending → idle transitions', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      tasks = [makeTask({ id: 'live', status: 'uploading' })]
      renderHook(() => useUploadQueue(), { wrapper })

      expect(addSpy.mock.calls.some(([evt]) => evt === 'beforeunload')).toBe(
        true
      )

      act(() => {
        tasks = [makeTask({ id: 'live', status: 'completed', progress: 100 })]
        notify()
      })

      expect(removeSpy.mock.calls.some(([evt]) => evt === 'beforeunload')).toBe(
        true
      )
    })
  })

  describe('enqueue', () => {
    it('is a no-op when given zero file contexts', async () => {
      const { result } = renderHook(() => useUploadQueue(), { wrapper })

      await act(async () => {
        await result.current.enqueue([])
      })

      expect(toast.loading).not.toHaveBeenCalled()
      expect(mockQueueFileUploadsWithContext).not.toHaveBeenCalled()
    })

    it('shows loading → success toast when all uploads complete', async () => {
      mockQueueFileUploadsWithContext.mockImplementation(async () => {
        tasks = [makeTask({ id: 'done', status: 'completed', progress: 100 })]
      })

      const { result } = renderHook(() => useUploadQueue(), { wrapper })

      await act(async () => {
        await result.current.enqueue([
          { attachment: { mode: 'upload' } as any, objectUuid: 'obj-1' },
        ])
      })

      expect(toast.loading).toHaveBeenCalledOnce()
      expect(toast.success).toHaveBeenCalledOnce()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('shows error toast when at least one upload fails', async () => {
      mockQueueFileUploadsWithContext.mockImplementation(async () => {
        tasks = [makeTask({ id: 'bad', status: 'failed', error: 'nope' })]
      })

      const { result } = renderHook(() => useUploadQueue(), { wrapper })

      await act(async () => {
        await result.current.enqueue([
          { attachment: { mode: 'upload' } as any, objectUuid: 'obj-1' },
        ])
      })

      expect(toast.error).toHaveBeenCalledOnce()
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('catches thrown errors from the service and still shows an error toast', async () => {
      mockQueueFileUploadsWithContext.mockRejectedValue(new Error('x'))

      const { result } = renderHook(() => useUploadQueue(), { wrapper })

      await act(async () => {
        await result.current.enqueue([
          { attachment: { mode: 'upload' } as any, objectUuid: 'obj-1' },
        ])
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Upload batch failed',
        expect.any(Error)
      )
      expect(toast.error).toHaveBeenCalledOnce()
    })
  })

  describe('clearCompleted', () => {
    it('delegates to service.clearCompleted()', () => {
      tasks = [makeTask({ id: 'a', status: 'completed', progress: 100 })]
      const { result } = renderHook(() => useUploadQueue(), { wrapper })

      act(() => {
        result.current.clearCompleted()
      })

      expect(mockClearCompleted).toHaveBeenCalledOnce()
    })
  })
})

describe('useUploadQueue / useOptionalUploadQueue', () => {
  it('useUploadQueue throws when rendered outside provider', () => {
    // renderHook swallows the throw into result.error
    const { result } = renderHook(() => {
      try {
        return useUploadQueue()
      } catch (err) {
        return err
      }
    })
    expect(result.current).toBeInstanceOf(Error)
  })

  it('useOptionalUploadQueue returns null outside provider', () => {
    const { result } = renderHook(() => useOptionalUploadQueue())
    expect(result.current).toBeNull()
  })
})
