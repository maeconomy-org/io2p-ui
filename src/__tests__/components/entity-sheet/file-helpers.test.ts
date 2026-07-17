import { describe, it, expect } from 'vitest'

import {
  fileDisplayName,
  isImageFile,
  newReferenceDraft,
  newUploadDraft,
} from '@/components/entity-sheet/files'
import type { DraftFile } from '@/lib/entity-body'

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
