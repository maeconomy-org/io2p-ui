import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ObjectFilesSection } from '@/components/entity-sheet/files/object-files-section'
import type { DraftFile } from '@/lib/entity'

const files = {
  preview: vi.fn(),
  download: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({ files }) }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// The view preference is account-scoped localStorage state; drive it directly.
let view = 'list'
const setView = vi.fn((next: string) => {
  view = next
})
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [view, setView],
}))

function renderSection(props: {
  files: DraftFile[]
  editing?: boolean
  onAttach?: () => void
  onRemove?: (localId: string) => void
  onChange?: (localId: string, patch: Partial<DraftFile>) => void
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ObjectFilesSection, {
        editing: false,
        ...props,
      })
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

describe('ObjectFilesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    view = 'list'
  })

  it('shows an empty state and no view toggle when there are no files', () => {
    renderSection({ files: [] })
    expect(screen.getByText('objects.files.noFiles')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('objects.files.gridView')
    ).not.toBeInTheDocument()
  })

  it('lists every file it is given', () => {
    renderSection({
      files: [
        upload(),
        upload({ _localId: 'f2', id: 'f2', fileName: 'plan.pdf' }),
      ],
    })
    expect(screen.getByText('objects.filesTitle')).toBeInTheDocument()
    expect(screen.getByText('spec.pdf')).toBeInTheDocument()
    expect(screen.getByText('plan.pdf')).toBeInTheDocument()
  })

  it('offers the attach control only while editing', () => {
    const onAttach = vi.fn()
    const { unmount } = renderSection({ files: [upload()], onAttach })
    expect(screen.queryByText('objects.files.addFiles')).not.toBeInTheDocument()
    unmount()

    renderSection({ files: [upload()], editing: true, onAttach })
    fireEvent.click(screen.getByText('objects.files.addFiles'))
    expect(onAttach).toHaveBeenCalled()
  })

  it('downloads an uploaded file from the list view', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderSection({ files: [upload()] })
    fireEvent.click(screen.getByRole('button', { name: /common.download/ }))

    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    clickSpy.mockRestore()
  })

  it('links a reference out instead of calling the files API', () => {
    renderSection({
      files: [
        {
          _localId: 'r1',
          kind: 'reference',
          reference: { url: 'https://example.com/spec' },
          label: 'Spec',
        },
      ],
    })

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://example.com/spec'
    )
    expect(files.download).not.toHaveBeenCalled()
  })

  it('switches to thumbnails in grid view', () => {
    view = 'grid'
    const { container } = renderSection({
      files: [
        upload({
          contentType: 'image/png',
          fileName: 'photo.png',
          thumbnailUrl: 'https://s3/thumb',
        }),
      ],
    })

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://s3/thumb'
    )
  })

  it('discards a pending pick from the draft — nothing was uploaded to keep', () => {
    const onRemove = vi.fn()
    renderSection({
      files: [{ _localId: 'p1', kind: 'upload', fileName: 'draft.txt' }],
      editing: true,
      onRemove,
    })

    fireEvent.click(screen.getByRole('button', { name: /^common.remove/ }))
    expect(onRemove).toHaveBeenCalledWith('p1')
  })

  it('detaches a reference — it has no files record to soft-delete', () => {
    const onRemove = vi.fn()
    renderSection({
      files: [
        {
          _localId: 'r1',
          kind: 'reference',
          reference: { url: 'https://example.com/spec' },
        },
      ],
      editing: true,
      onRemove,
    })

    fireEvent.click(screen.getByRole('button', { name: /^common.remove/ }))
    expect(onRemove).toHaveBeenCalledWith('r1')
    expect(files.delete).not.toHaveBeenCalled()
  })

  it('soft-deletes a stored file instead of removing it from the object', async () => {
    files.delete.mockResolvedValue({ id: 'f1', deleted: true })
    const onRemove = vi.fn()
    const onChange = vi.fn()
    renderSection({ files: [upload()], editing: true, onRemove, onChange })

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.delete/ })
    )
    expect(files.delete).not.toHaveBeenCalled() // first click only arms it
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))

    await waitFor(() => expect(files.delete).toHaveBeenCalledWith('f1'))
    expect(onRemove).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('f1', { deleted: true })
    )
  })

  it('offers only restore for a deleted file — it cannot be opened', async () => {
    files.restore.mockResolvedValue({ id: 'f1', deleted: false })
    const onChange = vi.fn()
    renderSection({
      files: [upload({ deleted: true })],
      editing: true,
      onChange,
    })

    expect(screen.getByText('common.deleted')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /common.download/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /objects.files.preview/ })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /^objects.files.restore/ })
    )
    await waitFor(() => expect(files.restore).toHaveBeenCalledWith('f1'))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('f1', { deleted: false })
    )
  })

  it('resolves a bare ref to discover it was deleted', async () => {
    files.get.mockResolvedValue({
      id: 'f1',
      fileName: 'gone.pdf',
      deleted: true,
    })
    // Enrichment skips a non-live file, so it arrives with an id and nothing else.
    renderSection({ files: [{ _localId: 'f1', id: 'f1', kind: 'upload' }] })

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

  it('opens the preview for a renderable file instead of downloading it', async () => {
    files.preview.mockResolvedValue({ url: 'https://s3/preview' })
    renderSection({
      files: [upload({ fileName: 'photo.png', contentType: 'image/png' })],
    })

    fireEvent.click(
      screen.getByRole('button', { name: /objects.files.preview/ })
    )

    await waitFor(() =>
      expect(screen.getByTestId('file-preview-dialog')).toBeInTheDocument()
    )
    expect(files.download).not.toHaveBeenCalled()
  })

  it('still offers a separate download control for a renderable file', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderSection({
      files: [upload({ fileName: 'photo.png', contentType: 'image/png' })],
    })

    fireEvent.click(screen.getByRole('button', { name: /common.download/ }))
    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    clickSpy.mockRestore()
  })

  it('downloads directly when the file cannot be rendered', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderSection({
      files: [
        upload({
          fileName: 'archive.zip',
          contentType: 'application/zip',
        }),
      ],
    })

    fireEvent.click(
      screen.getByRole('button', { name: /common.download archive.zip/ })
    )
    await waitFor(() => expect(files.download).toHaveBeenCalledWith('f1'))
    expect(files.preview).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('leaves a pending pick and a non-live upload inert', () => {
    renderSection({
      files: [
        { _localId: 'p1', kind: 'upload', fileName: 'draft.txt' },
        upload({ _localId: 'f9', id: 'f9', status: 'pending' }),
      ],
    })

    expect(
      screen.queryByRole('button', { name: /common.download/ })
    ).not.toBeInTheDocument()
  })
})
