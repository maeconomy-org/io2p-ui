import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

import { AttachmentPreview } from '@/components/attachments/attachment-preview'
import type { FileData } from '@/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

const getFileContent = vi.fn(async () => 'AAAA')
const sdkClient = { node: { getFileContent } }

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

// Silence the blob-URL side effects used by the internal useFileBlobUrl hook.
const createObjectURL = vi.fn(() => 'blob:stub')
const revokeObjectURL = vi.fn()

function file(partial: Partial<FileData> & { uuid: string }): FileData {
  return {
    fileName: `${partial.uuid}.png`,
    fileReference: `/api/UUFile/${partial.uuid}/download`,
    contentType: 'image/png',
    ...partial,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(global.URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
  })
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
  })
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
    // Name is rendered both in the visually hidden DialogTitle and in the
    // visible toolbar, so we query all and assert at least one.
    const hits = await screen.findAllByText('hello.png')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('routes a pdf file to the PdfViewer once the blob URL resolves', async () => {
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

  it('calls downloadFileToClient with the current uuid + mime + filename', async () => {
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
    expect(call[1]).toBe('a')
    expect(call[2]).toBe('image/png')
    expect(call[3]).toBe('hello.png')
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

    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
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
