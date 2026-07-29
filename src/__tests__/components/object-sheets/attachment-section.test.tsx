import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { AttachmentSection } from '@/components/object-sheets/components/attachment-section'
import type { Attachment } from '@/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

vi.mock('@/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('@/contexts')>('@/contexts')
  return {
    ...actual,
    useAppConfig: () => ({
      maxAttachmentSizeMB: 1024,
      maxImportFileSizeMB: 10,
      maxImportPayloadMB: 50,
      maxObjectsPerImport: 1000,
    }),
  }
})

vi.mock('../../../components/object-sheets/components/attachment-list', () => ({
  AttachmentList: ({ attachments }: { attachments: Attachment[] }) => (
    <ul data-testid="attachment-list">
      {attachments.map((a, i) => (
        <li key={i} data-testid={`att-${i}`}>
          {a.mode}:{a.fileName || a.fileReference}
        </li>
      ))}
    </ul>
  ),
}))

function Wrapper() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  return (
    <div>
      <AttachmentSection attachments={attachments} onChange={setAttachments} />
      <div data-testid="count">{attachments.length}</div>
    </div>
  )
}

function dropFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.drop(input, { dataTransfer: { files: [file], types: ['Files'] } })
}

describe('AttachmentSection', () => {
  it('adds a dropped file to attachments', async () => {
    render(<Wrapper />)
    const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' })
    await act(async () => {
      dropFile(file)
    })
    expect(await screen.findByText('upload:hello.pdf')).toBeInTheDocument()
  })

  it('adds a URL reference when Add is clicked', async () => {
    render(<Wrapper />)
    const urlInput = screen.getByPlaceholderText(
      /objects.attachments.externalUrl/i
    )
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/spec.pdf' },
    })
    fireEvent.click(screen.getByTestId('add-reference-button'))
    expect(
      await screen.findByText('reference:https://example.com/spec.pdf')
    ).toBeInTheDocument()
  })

  // Regression: concurrent drop + add-reference must not lose either attachment.
  // Before the attachmentsRef fix, handleDrop's stale closure over the
  // `attachments` prop caused the later onChange() call to overwrite the
  // earlier one — the file or the reference would silently disappear.
  it('preserves both attachments when drop and add-reference fire in quick succession', async () => {
    render(<Wrapper />)

    const urlInput = screen.getByPlaceholderText(
      /objects.attachments.externalUrl/i
    )
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/ref.pdf' },
    })

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })

    await act(async () => {
      dropFile(file)
      fireEvent.click(screen.getByTestId('add-reference-button'))
    })

    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByText('upload:doc.pdf')).toBeInTheDocument()
    expect(
      screen.getByText('reference:https://example.com/ref.pdf')
    ).toBeInTheDocument()
  })

  it('preserves earlier attachments when a subsequent reference is added', async () => {
    render(<Wrapper />)

    const file = new File(['x'], 'first.pdf', { type: 'application/pdf' })
    await act(async () => {
      dropFile(file)
    })
    expect(await screen.findByText('upload:first.pdf')).toBeInTheDocument()

    const urlInput = screen.getByPlaceholderText(
      /objects.attachments.externalUrl/i
    )
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/second.pdf' },
    })
    fireEvent.click(screen.getByTestId('add-reference-button'))

    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByText('upload:first.pdf')).toBeInTheDocument()
    expect(
      screen.getByText('reference:https://example.com/second.pdf')
    ).toBeInTheDocument()
  })

  it('does not add a reference when URL is empty', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByTestId('add-reference-button'))
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})
