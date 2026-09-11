import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { AttachmentModal } from '@/components/entity-sheet/files/attachment-modal'

/**
 * The attachment size cap, which is a CLIENT decision and only a client decision.
 *
 * `attachment-modal.tsx` compares each dropped file against `useAppConfig().maxAttachmentSizeMB`;
 * nothing on the node enforces an attachment size, so this filter is the only place the refusal
 * exists. It had no coverage at any level, and `05-upload-center/deferred.spec.ts` TC262 has stood
 * as a permanent `test.skip` waiting for backend validation that is not coming.
 *
 * NOT an e2e case, and that was measured rather than assumed. The cap defaults to 1024 MB, so an
 * honest browser case needs a 1 GB fixture — and it cannot be lowered for one spec, because
 * `query-context.tsx` builds the config on the SERVER and hands it down as a prop rather than
 * reading `__IOM_CONFIG__` in the browser. Overriding it per test is impossible; the only lever is
 * the deployment's own env, which would change what every other upload case sees.
 *
 * The PARTIAL acceptance is the half worth having. `onDrop` filters rather than aborts, so a build
 * that refused the whole batch would still show the same message — a case asserting only the error
 * would pass on it.
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const config = { maxAttachmentSizeMB: 1 }
vi.mock('@/contexts', () => ({ useAppConfig: () => config }))

const MB = 1024 * 1024

function file(name: string, size: number): File {
  const f = new File(['x'], name, { type: 'application/octet-stream' })
  // `File` has no writable size, and constructing a real 2 MB blob per case is wasteful — the
  // component only ever reads `.size`.
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function renderModal(onAdd = vi.fn()) {
  render(
    React.createElement(AttachmentModal, {
      open: true,
      onOpenChange: vi.fn(),
      onAdd,
    })
  )
  return onAdd
}

/**
 * `react-dropzone` reads `target.files` and resolves its own promise before calling `onDrop`, so
 * every assertion after this one has to be awaited — a synchronous `getByText` runs a tick early
 * and finds nothing, which reads exactly like the filter not working.
 */
async function drop(files: File[]): Promise<void> {
  const input = document.querySelector(
    'input[type=file]'
  ) as HTMLInputElement | null
  if (!input) throw new Error('the dropzone rendered no file input')
  fireEvent.change(input, { target: { files } })
  await waitFor(() => expect(input).toBeTruthy())
}

describe('AttachmentModal — the size cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.maxAttachmentSizeMB = 1
  })

  it('names the over-size file it skipped, and the cap it applied', async () => {
    renderModal()
    await drop([file('huge.bin', 2 * MB)])

    // The NAME and the SIZE, both — the message exists so the user knows which file went and why,
    // and a message naming neither is the same as no message.
    const error = await screen.findByText(/dropzoneOversize/)
    expect(error.textContent).toContain('huge.bin')
    expect(error.textContent).toContain('"size":1')
  })

  it('keeps the under-cap files from the SAME drop', async () => {
    renderModal()
    await drop([file('huge.bin', 2 * MB), file('small.txt', 1024)])

    // Filtered, not aborted. This is what separates the two builds the error message cannot.
    expect(await screen.findByDisplayValue('small')).toBeTruthy()
    expect(screen.queryByDisplayValue('huge')).toBeNull()
  })

  it('accepts a file exactly at the cap', async () => {
    renderModal()
    await drop([file('exactly.bin', 1 * MB)])

    // The comparison is `>`, not `>=`. A boundary flipped the other way would refuse a file the
    // deployment's own copy says is allowed.
    expect(await screen.findByDisplayValue('exactly')).toBeTruthy()
    expect(screen.queryByText(/dropzoneOversize/)).toBeNull()
  })

  it('follows the deployment cap rather than a constant', async () => {
    config.maxAttachmentSizeMB = 4
    renderModal()
    await drop([file('two-mb.bin', 2 * MB)])

    // The same file that was refused above. Without this the suite cannot tell the component from
    // one that hardcodes 1 MB.
    expect(await screen.findByDisplayValue('two-mb')).toBeTruthy()
    expect(screen.queryByText(/dropzoneOversize/)).toBeNull()
  })
})
