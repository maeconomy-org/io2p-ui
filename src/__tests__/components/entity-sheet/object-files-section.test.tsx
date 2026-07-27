import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ObjectFilesSection } from '@/components/entity-sheet/files/object-files-section'
import type { DraftFile } from '@/lib/entity-body'

const files = { preview: vi.fn(), download: vi.fn() }

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

  it('counts the files it is showing', () => {
    renderSection({ files: [upload(), upload({ _localId: 'f2', id: 'f2' })] })
    expect(
      screen.getByText('objects.files.filesCount:{"count":2}')
    ).toBeInTheDocument()
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

  it('removes a file from the draft when editing', () => {
    const onRemove = vi.fn()
    renderSection({ files: [upload()], editing: true, onRemove })

    fireEvent.click(screen.getByRole('button', { name: 'common.remove' }))
    expect(onRemove).toHaveBeenCalledWith('f1')
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
