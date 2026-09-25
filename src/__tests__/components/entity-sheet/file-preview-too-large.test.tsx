import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { FilePreview } from '@/components/entity-sheet/files/file-preview'
import type { DraftFile } from '@/lib/entity'

/**
 * The 100 MB inline-preview gate.
 *
 * `INLINE_PREVIEW_MAX_BYTES` is a hardcoded constant, not a deployment setting, and it is read off
 * the file RECORD's `size` rather than the bytes — so nothing has to be downloaded to trip it. That
 * is what makes this a unit concern: an e2e case would have to upload 100 MB, or intercept the
 * response and rewrite `size`, which asserts against a fixture we authored either way.
 *
 * Gated on `SIZE_GUARDED_KINDS` — image, pdf, text — so both halves are here: an over-size PDF
 * falls back, and an over-size kind OUTSIDE that set does not. Without the second, a build that
 * guarded every kind would pass.
 */

const files = {
  preview: vi.fn(),
  download: vi.fn(),
  get: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({ files }) }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const OVER = 101 * 1024 * 1024
const UNDER = 2 * 1024 * 1024

function draft(patch: Partial<DraftFile>): DraftFile {
  return {
    _localId: 'f1',
    id: 'f1',
    fileName: 'plan.pdf',
    contentType: 'application/pdf',
    ...patch,
  } as DraftFile
}

function renderPreview(file: DraftFile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FilePreview, {
        file,
        open: true,
        onOpenChange: vi.fn(),
      })
    )
  )
}

describe('FilePreview — the inline size cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back instead of previewing a guarded file over the cap', async () => {
    renderPreview(draft({ size: OVER }))

    const panel = await screen.findByTestId('file-preview-too-large')
    // The name INSIDE the fallback, not anywhere on screen — the dialog title carries it too, so an
    // unscoped query matches whether or not the panel names the file it is refusing to show.
    expect(within(panel).getByText('plan.pdf')).toBeTruthy()
  })

  it('previews the same kind under the cap', async () => {
    renderPreview(draft({ size: UNDER }))

    expect(screen.queryByTestId('file-preview-too-large')).toBeNull()
  })

  /**
   * The gate is keyed on KIND, not on size alone. Video streams by Range request, so it is
   * deliberately outside `SIZE_GUARDED_KINDS` however large it is — the whole reason the set exists.
   */
  it('does not gate a kind that streams, at the same size', async () => {
    renderPreview(
      draft({
        fileName: 'clip.mp4',
        contentType: 'video/mp4',
        size: OVER,
      })
    )

    expect(screen.queryByTestId('file-preview-too-large')).toBeNull()
  })
})
