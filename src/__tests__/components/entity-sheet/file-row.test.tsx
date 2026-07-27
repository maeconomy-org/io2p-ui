import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { FileRow } from '@/components/entity-sheet/files/file-row'
import type { DraftFile } from '@/lib/entity-body'

const files = {
  preview: vi.fn(),
  download: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ files }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function renderRow(file: DraftFile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FileRow, { file, editing: false })
    )
  )
}

const upload = (over: Partial<DraftFile> = {}): DraftFile => ({
  _localId: 'f1',
  id: 'f1',
  kind: 'upload',
  fileName: 'spec.pdf',
  status: 'ready',
  ...over,
})

describe('FileRow', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })
  afterEach(() => clickSpy.mockRestore())

  // Regression: the read model never carries a `downloadUrl`, so a row that relied on one rendered
  // as inert text with no way to open the file.
  it('renders an enabled control for an uploaded file that has no downloadUrl', () => {
    renderRow(upload())
    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(screen.getByText('spec.pdf')).toBeInTheDocument()
  })

  it('is type="button" so it cannot submit the surrounding entity form', () => {
    renderRow(upload())
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('mints a presigned url and navigates an anchor on click', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download?sig=abc' })
    let href = ''
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      href = this.href
    })

    renderRow(upload())
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    await waitFor(() => expect(href).toBe('https://s3/download?sig=abc'))
  })

  it('links a reference straight to its external url without touching the API', () => {
    renderRow({
      _localId: 'r1',
      kind: 'reference',
      reference: { url: 'https://example.com/datasheet' },
      label: 'Datasheet',
    })

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com/datasheet')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(files.download).not.toHaveBeenCalled()
  })

  it('leaves a pending pick inert — there is nothing to download yet', () => {
    renderRow({
      _localId: 'p1',
      kind: 'upload',
      blob: new File(['x'], 'draft.txt'),
      fileName: 'draft.txt',
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('draft.txt')).toBeInTheDocument()
  })

  it('leaves a soft-deleted or not-ready file inert', () => {
    // Enrichment skips a non-live file, so it arrives as a bare ref with no fileName.
    const { unmount } = renderRow({ _localId: 'f2', id: 'f2', kind: 'upload' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()

    renderRow(upload({ status: 'pending' }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('prefetches the url once when the pointer enters the row and then the button', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const { container } = renderRow(upload())

    fireEvent.mouseEnter(container.firstChild as Element)
    fireEvent.mouseEnter(screen.getByRole('button'))

    await waitFor(() => expect(files.download).toHaveBeenCalledTimes(1))
  })

  it('falls back to an icon when an expired thumbnail url fails to load', () => {
    const { container } = renderRow(
      upload({
        contentType: 'image/png',
        fileName: 'photo.png',
        thumbnailUrl: 'https://s3/thumb',
      })
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(container.querySelector('img')).toBeNull()
  })
})
