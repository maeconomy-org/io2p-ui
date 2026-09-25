import { describe, it, expect } from 'vitest'

import {
  fileDisplayName,
  isImageFile,
  newReferenceDraft,
  newUploadDraft,
} from '@/components/entity-sheet/files'
import { splitFileName } from '@/components/entity-sheet/files/file-helpers'
import type { DraftFile } from '@/lib/entity'

describe('file-helpers', () => {
  it('newUploadDraft maps a File to a pending upload draft', () => {
    const file = new File(['x'], 'spec.pdf', { type: 'application/pdf' })
    const f = newUploadDraft(file)
    expect(f).toMatchObject({
      kind: 'upload',
      blob: file,
      fileName: 'spec.pdf',
      contentType: 'application/pdf',
    })
    expect(f._localId).toBeTruthy()
    expect(f.id).toBeUndefined() // not uploaded yet
  })

  it('newUploadDraft leaves contentType undefined when the File has none', () => {
    expect(newUploadDraft(new File(['x'], 'a.bin')).contentType).toBeUndefined()
  })

  it('newReferenceDraft trims the label and drops a blank one', () => {
    expect(newReferenceDraft('https://x/y', '  Datasheet ')).toMatchObject({
      kind: 'reference',
      reference: { url: 'https://x/y' },
      label: 'Datasheet',
    })
    expect(newReferenceDraft('https://x/y', '   ').label).toBeUndefined()
  })

  it('fileDisplayName prefers label→url for references, fileName for uploads', () => {
    expect(
      fileDisplayName({
        _localId: '1',
        kind: 'reference',
        reference: { url: 'https://x/y' },
        label: 'Spec',
      })
    ).toBe('Spec')
    expect(
      fileDisplayName({
        _localId: '2',
        kind: 'reference',
        reference: { url: 'https://x/y' },
      })
    ).toBe('https://x/y')
    expect(
      fileDisplayName({ _localId: '3', kind: 'upload', fileName: 'a.pdf' })
    ).toBe('a.pdf')
  })

  it('isImageFile detects by coarse type or content type', () => {
    const img: DraftFile = { _localId: '1', kind: 'upload', type: 'image' }
    const byMime: DraftFile = {
      _localId: '2',
      kind: 'upload',
      contentType: 'image/png',
    }
    const doc: DraftFile = {
      _localId: '3',
      kind: 'upload',
      contentType: 'application/pdf',
    }
    expect(isImageFile(img)).toBe(true)
    expect(isImageFile(byMime)).toBe(true)
    expect(isImageFile(doc)).toBe(false)
  })
})

describe('splitFileName', () => {
  it('separates the stem from its extension', () => {
    expect(splitFileName('spec.pdf')).toEqual({ stem: 'spec', ext: '.pdf' })
  })

  it('splits on the LAST dot so multi-dot names keep their real extension', () => {
    expect(splitFileName('Screenshot 2026-07-17 at 20.09.18.png')).toEqual({
      stem: 'Screenshot 2026-07-17 at 20.09.18',
      ext: '.png',
    })
  })

  it('treats a dotfile as all stem — the leading dot is not an extension', () => {
    expect(splitFileName('.env')).toEqual({ stem: '.env', ext: '' })
  })

  it('handles a name with no extension', () => {
    expect(splitFileName('README')).toEqual({ stem: 'README', ext: '' })
  })
})
