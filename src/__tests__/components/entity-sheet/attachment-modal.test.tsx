import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { AttachmentModal } from '@/components/entity-sheet/files/attachment-modal'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/contexts', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1 }),
}))

function renderModal() {
  const onAdd = vi.fn()
  const onOpenChange = vi.fn()
  render(
    React.createElement(AttachmentModal, { open: true, onOpenChange, onAdd })
  )
  return { onAdd, onOpenChange }
}

async function pickFile() {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'plan.pdf')] },
  })
  await screen.findByDisplayValue('plan')
}

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } })
const clickDone = () =>
  fireEvent.click(screen.getByTestId('attachment-modal-done'))

describe('AttachmentModal — Done', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the dialog open when a label has no link, instead of dropping the label', async () => {
    const { onAdd, onOpenChange } = renderModal()
    await pickFile()
    type('attachment-modal-label', 'Drawing')

    clickDone()

    expect(
      screen.getByText('objects.files.labelWithoutUrl')
    ).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('says the bad link blocks the picked files, and keeps them', async () => {
    const { onAdd } = renderModal()
    await pickFile()
    type('attachment-modal-url', 'foo')

    clickDone()

    expect(
      screen.getByText('objects.files.invalidUrlWithFiles')
    ).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('plan')).toBeInTheDocument()
  })

  it('adds the picked files when no link or label is typed', async () => {
    const { onAdd } = renderModal()
    await pickFile()

    clickDone()

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce())
  })
})
