import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { FileRow } from '@/components/entity-sheet/files/file-row'
import type { DraftFile } from '@/lib/entity'

const files = {
  preview: vi.fn(),
  download: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
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

function renderRow(
  file: DraftFile,
  props: Partial<React.ComponentProps<typeof FileRow>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FileRow, { file, editing: false, ...props })
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

const downloadButton = () =>
  screen.queryByRole('button', { name: /^common.download/ })
const previewButton = () =>
  screen.queryByRole('button', { name: /^objects.files.preview/ })

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
  it('offers a download action for a stored file that has no downloadUrl', () => {
    renderRow(upload())
    expect(downloadButton()).toBeEnabled()
    expect(screen.getByText('spec.pdf')).toBeInTheDocument()
  })

  it('renders actions as buttons so they cannot submit the surrounding form', () => {
    renderRow(upload())
    screen
      .getAllByRole('button')
      .forEach((b) => expect(b).toHaveAttribute('type', 'button'))
  })

  it('mints a presigned url and navigates an anchor on download', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download?sig=abc' })
    let href = ''
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      href = this.href
    })

    renderRow(upload())
    fireEvent.click(downloadButton()!)

    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    await waitFor(() => expect(href).toBe('https://s3/download?sig=abc'))
  })

  it('previews a renderable file in-app rather than downloading it', () => {
    const onPreview = vi.fn()
    const file = upload({ fileName: 'photo.png', contentType: 'image/png' })
    renderRow(file, { onPreview })

    fireEvent.click(previewButton()!)
    // The merged file is handed over, so a restored bare ref still carries its mime type.
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ _localId: 'f1', fileName: 'photo.png' })
    )
    expect(files.download).not.toHaveBeenCalled()
  })

  it('offers no preview for a file no viewer can render', () => {
    renderRow(
      upload({ fileName: 'archive.zip', contentType: 'application/zip' }),
      {
        onPreview: vi.fn(),
      }
    )
    expect(previewButton()).not.toBeInTheDocument()
    expect(downloadButton()).toBeInTheDocument()
  })

  it('links a reference out and never touches the files API', () => {
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

  it('leaves a pending pick with nothing to open', () => {
    renderRow({
      _localId: 'p1',
      kind: 'upload',
      blob: new File(['x'], 'draft.txt'),
      fileName: 'draft.txt',
    })

    expect(downloadButton()).not.toBeInTheDocument()
    expect(screen.getByText('draft.txt')).toBeInTheDocument()
  })

  it('soft-deletes a stored file rather than detaching it', async () => {
    files.delete.mockResolvedValue({ id: 'f1', deleted: true })
    const onChange = vi.fn()
    const onRemove = vi.fn()
    renderRow(upload(), { editing: true, onChange, onRemove })

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.delete/ })
    )
    // First click only arms it — nothing has happened yet.
    expect(files.delete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))

    await waitFor(() => expect(files.delete).toHaveBeenCalledWith('f1'))
    expect(onRemove).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('f1', { deleted: true })
    )
  })

  it('offers delete outside edit mode — it is a server action, not a draft edit', () => {
    renderRow(upload())
    expect(
      screen.getByRole('button', { name: /^objects.files.delete/ })
    ).toBeInTheDocument()
  })

  it('shows a deleted file as restorable and unopenable', async () => {
    files.restore.mockResolvedValue({ id: 'f1', deleted: false })
    const onChange = vi.fn()
    renderRow(upload({ deleted: true }), { onChange })

    expect(screen.getByText('common.deleted')).toBeInTheDocument()
    expect(downloadButton()).not.toBeInTheDocument()
    expect(previewButton()).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.restore/ })
    )
    await waitFor(() => expect(files.restore).toHaveBeenCalledWith('f1'))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('f1', { deleted: false })
    )
  })

  it('resolves a bare ref to find out it was deleted', async () => {
    files.get.mockResolvedValue({
      id: 'f1',
      fileName: 'gone.pdf',
      deleted: true,
    })
    renderRow({ _localId: 'f1', id: 'f1', kind: 'upload' })

    await waitFor(() =>
      expect(files.get).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
    await waitFor(() =>
      expect(screen.getByText('gone.pdf')).toBeInTheDocument()
    )
    expect(screen.getByText('common.deleted')).toBeInTheDocument()
  })

  it('prefetches once when the pointer enters the row and then an action', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    // A zip has no viewer, so the primary action is download and that is what gets warmed.
    const { container } = renderRow(
      upload({ fileName: 'archive.zip', contentType: 'application/zip' })
    )

    fireEvent.mouseEnter(container.firstChild as Element)
    fireEvent.mouseEnter(downloadButton()!)

    await waitFor(() => expect(files.download).toHaveBeenCalledTimes(1))
  })

  it('warms the preview url instead when the file can be rendered', async () => {
    files.preview.mockResolvedValue({ url: 'https://s3/preview' })
    const { container } = renderRow(
      upload({ fileName: 'photo.png', contentType: 'image/png' })
    )

    fireEvent.mouseEnter(container.firstChild as Element)

    await waitFor(() => expect(files.preview).toHaveBeenCalledTimes(1))
    expect(files.download).not.toHaveBeenCalled()
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

describe('FileRow row click', () => {
  beforeEach(() => vi.clearAllMocks())

  it('previews on a row click when the file can be rendered', () => {
    const onPreview = vi.fn()
    const { container } = renderRow(
      upload({ fileName: 'photo.png', contentType: 'image/png' }),
      { onPreview }
    )

    fireEvent.click(container.firstChild as Element)
    expect(onPreview).toHaveBeenCalled()
    expect(files.download).not.toHaveBeenCalled()
  })

  it('downloads on a row click when nothing can render it', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const onPreview = vi.fn()
    const { container } = renderRow(
      upload({ fileName: 'archive.zip', contentType: 'application/zip' }),
      { onPreview }
    )

    fireEvent.click(container.firstChild as Element)

    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    expect(onPreview).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('does not fire the row action twice when an icon is clicked', () => {
    const onPreview = vi.fn()
    renderRow(upload({ fileName: 'photo.png', contentType: 'image/png' }), {
      onPreview,
    })

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.preview/ })
    )
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it('a restored file that loaded bare becomes openable again', async () => {
    // It arrives with only an id, so resolvability has to come from the resolved record.
    files.get.mockResolvedValue({
      id: 'f1',
      fileName: 'photo.png',
      contentType: 'image/png',
      status: 'ready',
      deleted: false,
    })
    renderRow(
      { _localId: 'f1', id: 'f1', kind: 'upload' },
      {
        onPreview: vi.fn(),
      }
    )

    await waitFor(() =>
      expect(files.get).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^objects.files.preview/ })
      ).toBeInTheDocument()
    )
    expect(downloadButton()).toBeInTheDocument()
  })
})

describe('FileRow without a parent patcher', () => {
  beforeEach(() => vi.clearAllMocks())

  // A read-only view has no draft to write back to, so the row has to hold the outcome itself —
  // otherwise a deleted file keeps rendering as live and only fails when you try to open it.
  it('reflects its own delete even when nothing wires onChange', async () => {
    files.delete.mockResolvedValue({ id: 'f1', deleted: true })
    renderRow(upload())

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.delete/ })
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))

    await waitFor(() => expect(files.delete).toHaveBeenCalledWith('f1'))
    await waitFor(() =>
      expect(screen.getByText('common.deleted')).toBeInTheDocument()
    )
    expect(downloadButton()).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^objects.files.restore/ })
    ).toBeInTheDocument()
  })

  it('reflects its own restore the same way', async () => {
    files.restore.mockResolvedValue({ id: 'f1', deleted: false })
    renderRow(upload({ deleted: true }))

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.restore/ })
    )

    await waitFor(() => expect(files.restore).toHaveBeenCalledWith('f1'))
    await waitFor(() => expect(downloadButton()).toBeInTheDocument())
    expect(screen.queryByText('common.deleted')).not.toBeInTheDocument()
  })
})
