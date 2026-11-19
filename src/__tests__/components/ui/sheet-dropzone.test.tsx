import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { SheetDropzone } from '@/components/ui/sheet-dropzone'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function dropOnRoot(file: File) {
  const root = screen.getByTestId('sheet-dropzone')
  fireEvent.drop(root, {
    dataTransfer: { files: [file], types: ['Files'] },
  })
}

describe('SheetDropzone', () => {
  it('renders children and hides overlay by default', () => {
    render(
      <SheetDropzone onFiles={() => {}}>
        <p>body content</p>
      </SheetDropzone>
    )
    expect(screen.getByText('body content')).toBeInTheDocument()
    expect(screen.queryByTestId('sheet-dropzone-overlay')).toBeNull()
  })

  it('calls onFiles with the dropped files', async () => {
    const onFiles = vi.fn()
    render(
      <SheetDropzone onFiles={onFiles}>
        <p>body</p>
      </SheetDropzone>
    )
    const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' })
    await act(async () => {
      dropOnRoot(file)
    })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0][0]).toHaveLength(1)
    expect(onFiles.mock.calls[0][0][0].name).toBe('hello.pdf')
  })

  it('does not call onFiles when disabled', async () => {
    const onFiles = vi.fn()
    render(
      <SheetDropzone onFiles={onFiles} disabled>
        <p>body</p>
      </SheetDropzone>
    )
    const file = new File(['x'], 'x.txt', { type: 'text/plain' })
    await act(async () => {
      dropOnRoot(file)
    })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('shows overlay while a drag is over the root', async () => {
    render(
      <SheetDropzone onFiles={() => {}}>
        <p>body</p>
      </SheetDropzone>
    )
    const root = screen.getByTestId('sheet-dropzone')
    await act(async () => {
      fireEvent.dragEnter(root, {
        dataTransfer: { files: [], types: ['Files'] },
      })
    })
    expect(screen.getByTestId('sheet-dropzone-overlay')).toBeInTheDocument()
  })
})
