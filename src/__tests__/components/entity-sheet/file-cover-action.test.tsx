import { describe, it, expect } from 'vitest'
import type { DraftFile } from '@/lib/entity'

import { canBeCover } from '@/components/entity-sheet/files/file-actions'

const file = (extra: Partial<DraftFile> = {}): DraftFile => ({
  _localId: 'l1',
  id: 'f1',
  kind: 'upload',
  status: 'ready',
  contentType: 'image/jpeg',
  ...extra,
})

/**
 * These mirror the server's five rules. The point is that the button never offers something the
 * node would 422 — every rejection here is a request the user never has to see fail.
 */
describe('canBeCover', () => {
  it('accepts a ready, live, uploaded image', () => {
    expect(canBeCover(file(), false)).toBe(true)
  })

  it('rejects a deleted file', () => {
    expect(canBeCover(file(), true)).toBe(false)
  })

  it('rejects an external reference', () => {
    // A reference has no files-collection row, so the server rejects it by construction.
    expect(
      canBeCover(
        file({ kind: 'reference', reference: { url: 'https://x/y.jpg' } }),
        false
      )
    ).toBe(false)
  })

  it('rejects a pick that has not been uploaded yet', () => {
    // No id means no stored file to point at.
    expect(canBeCover(file({ id: undefined }), false)).toBe(false)
  })

  it('rejects an upload still in flight', () => {
    expect(canBeCover(file({ status: 'pending' }), false)).toBe(false)
  })

  it.each([
    ['a video', 'video/mp4'],
    ['a pdf', 'application/pdf'],
    ['a spreadsheet', 'application/vnd.ms-excel'],
  ])('rejects %s', (_case, contentType) => {
    // Video is deferred with the video-thumbnail decision: no poster worker, so nothing to render.
    expect(canBeCover(file({ contentType }), false)).toBe(false)
  })
})
