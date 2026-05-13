import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

import { AttachmentPreview } from '@/components/attachments/attachment-preview'
import type { FileData } from '@/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

const sdkClient = { fileStorage: { getDownloadUrl: vi.fn() } }

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => sdkClient,
}))

vi.mock('@/lib', async () => {
  const actual = await vi.importActual<typeof import('@/lib')>('@/lib')
  return {
    ...actual,
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  }
})

// The hook now returns a string URL straight from the file-storage SDK; the
// viewer components consume it as a plain `src`. Mock it so the dialog
// renders without spinning up React Query.
vi.mock('@/components/attachments/use-file-preview-url', () => ({
  useFilePreviewUrl: (file: FileData | null) => ({
    url: file ? `https://s3.example/${file.uuid}?X-Amz-Signature=sig` : null,
    expiresAt: '2030-01-01T00:00:00Z',
    isLoading: false,
    error: null,
  }),
}))

// Replace the lazy-loaded viewers with cheap stubs so we don't need to wait
// for Next's dynamic() machinery in a jsdom unit test.
vi.mock('@/components/attachments/pdf-viewer', () => ({
  PdfViewer: ({ title }: { title: string }) => (
    <div data-testid="pdf-viewer">{title}</div>
  ),
}))
vi.mock('@/components/attachments/media-viewer', () => ({
  MediaViewer: ({ kind }: { kind: string }) => (
    <div data-testid={`media-viewer-${kind}`} />
  ),
}))
vi.mock('@/components/attachments/text-viewer', () => ({
  TextViewer: () => <div data-testid="text-viewer" />,
}))

vi.mock('@/components/attachments/download-file', () => ({
  downloadFileToClient: vi.fn(async () => undefined),
}))

import { downloadFileToClient } from '@/components/attachments/download-file'

function file(partial: Partial<FileData> & { uuid: string }): FileData {
  return {
    fileName: `${partial.uuid}.png`,
    // S3-backed files always carry a non-empty fileReference (storage UUID).
    // Default it to `storage-${uuid}` so the read path treats this as internal.
    fileReference: `storage-${partial.uuid}`,
    contentType: 'image/png',
    ...partial,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttachmentPreview', () => {
  it('renders nothing when no file is supplied', () => {
    const { container } = render(
      <AttachmentPreview file={null} open onOpenChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the display name in the toolbar', async () => {
    render(
      <AttachmentPreview
        file={file({ uuid: 'a', fileName: 'hello.png' })}
        open
        onOpenChange={() => {}}
      />
    )
    const hits = await screen.findAllByText('hello.png')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('passes the presigned URL into the image viewer as src', async () => {
    render(
      <AttachmentPreview
        file={file({ uuid: 'img1', fileName: 'photo.png' })}
        open
        onOpenChange={() => {}}
      />
    )
    const img = await screen.findByAltText('photo.png')
    expect(img.getAttribute('src')).toBe(
      'https://s3.example/img1?X-Amz-Signature=sig'
    )
  })

  it('routes a pdf file to the PdfViewer', async () => {
    render(
      <AttachmentPreview
        file={file({
          uuid: 'p1',
          fileName: 'doc.pdf',
          contentType: 'application/pdf',
        })}
        open
        onOpenChange={() => {}}
      />
    )
    expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument()
  })

  it('routes a video file to the MediaViewer', async () => {
    render(
      <AttachmentPreview
        file={file({
          uuid: 'v1',
          fileName: 'clip.mp4',
          contentType: 'video/mp4',
        })}
        open
        onOpenChange={() => {}}
      />
    )
    expect(await screen.findByTestId('media-viewer-video')).toBeInTheDocument()
  })

  it('calls downloadFileToClient with uuid + filename', async () => {
    render(
      <AttachmentPreview
        file={file({ uuid: 'a', fileName: 'hello.png' })}
        open
        onOpenChange={() => {}}
      />
    )

    const btn = await screen.findByTestId('attachment-preview-download')
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(downloadFileToClient).toHaveBeenCalledTimes(1)
    const call = (downloadFileToClient as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0]
    expect(call[1]).toBe('storage-a')
    expect(call[2]).toBe('hello.png')
  })

  it('shows the sibling counter and navigates with the Next button', async () => {
    const siblings = [
      file({ uuid: 'a', fileName: 'one.png' }),
      file({ uuid: 'b', fileName: 'two.png' }),
      file({ uuid: 'c', fileName: 'three.png' }),
    ]
    render(
      <AttachmentPreview
        file={siblings[0]}
        siblings={siblings}
        open
        onOpenChange={() => {}}
      />
    )

    expect(
      await screen.findByText(
        'attachments.preview.counter:{"current":1,"total":3}'
      )
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('attachment-preview-next'))

    expect(
      await screen.findByText(
        'attachments.preview.counter:{"current":2,"total":3}'
      )
    ).toBeInTheDocument()
  })

  it('wraps around to the first sibling from the last via ArrowRight', async () => {
    const siblings = [
      file({ uuid: 'a', fileName: 'one.png' }),
      file({ uuid: 'b', fileName: 'two.png' }),
    ]
    render(
      <AttachmentPreview
        file={siblings[1]}
        siblings={siblings}
        open
        onOpenChange={() => {}}
      />
    )

    await screen.findByText(
      'attachments.preview.counter:{"current":2,"total":2}'
    )

    const dialog = screen.getByTestId('attachment-preview-dialog')
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    })

    await waitFor(() =>
      expect(
        screen.getByText('attachments.preview.counter:{"current":1,"total":2}')
      ).toBeInTheDocument()
    )
  })

  it('calls onOpenChange(false) when the close button is pressed', async () => {
    const onOpenChange = vi.fn()
    render(
      <AttachmentPreview
        file={file({ uuid: 'a' })}
        open
        onOpenChange={onOpenChange}
      />
    )
    const close = await screen.findByLabelText('common.close')
    fireEvent.click(close)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('filters soft-deleted files out of the sibling pool', async () => {
    const siblings = [
      file({ uuid: 'a', fileName: 'one.png' }),
      file({ uuid: 'b', fileName: 'two.png', softDeleted: true }),
      file({ uuid: 'c', fileName: 'three.png' }),
    ]
    render(
      <AttachmentPreview
        file={siblings[0]}
        siblings={siblings}
        open
        onOpenChange={() => {}}
      />
    )
    expect(
      await screen.findByText(
        'attachments.preview.counter:{"current":1,"total":2}'
      )
    ).toBeInTheDocument()
  })
})
