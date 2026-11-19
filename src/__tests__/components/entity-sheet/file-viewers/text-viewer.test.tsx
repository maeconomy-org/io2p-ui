import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { TextViewer } from '@/components/entity-sheet/file-viewers/text-viewer'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const originalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

function fakeResponse(body: string) {
  return {
    blob: async () => ({
      size: body.length,
      text: async () => body,
    }),
  } as unknown as Response
}

describe('TextViewer', () => {
  it('renders fetched text content inside a <pre>', async () => {
    global.fetch = vi.fn(async () =>
      fakeResponse('hello world')
    ) as typeof fetch

    render(<TextViewer src="blob:stub" />)

    expect(await screen.findByText('hello world')).toBeInTheDocument()
    const pre = screen.getByText('hello world')
    expect(pre.tagName).toBe('PRE')
  })

  it('shows the too-large message when blob exceeds maxBytes', async () => {
    global.fetch = vi.fn(async () =>
      fakeResponse('x'.repeat(100))
    ) as typeof fetch

    render(<TextViewer src="blob:stub" maxBytes={10} />)

    expect(
      await screen.findByText('attachments.preview.tooLargeForPreview')
    ).toBeInTheDocument()
  })

  it('aborts the pending fetch when the component unmounts', async () => {
    const seenSignals: AbortSignal[] = []
    global.fetch = vi.fn(
      async (_input: unknown, init?: { signal?: AbortSignal }) => {
        if (init?.signal) seenSignals.push(init.signal)
        // Never resolve — the test drives the abort path.
        return await new Promise<Response>(() => {})
      }
    ) as unknown as typeof fetch

    const { unmount } = render(<TextViewer src="blob:stub" />)

    await waitFor(() => expect(seenSignals.length).toBe(1))
    expect(seenSignals[0].aborted).toBe(false)

    unmount()

    expect(seenSignals[0].aborted).toBe(true)
  })

  it('surfaces a load-failed message when fetch rejects', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('net')
    }) as typeof fetch

    render(<TextViewer src="blob:stub" />)

    expect(
      await screen.findByText('attachments.preview.loadFailed')
    ).toBeInTheDocument()
  })
})
