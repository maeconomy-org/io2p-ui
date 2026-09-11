import { describe, it, expect } from 'vitest'
import type { ObjectDTO } from 'io2p-client'

import { objectToDuplicateInput } from '@/lib/entity/duplicate'

function source(over: Partial<ObjectDTO> = {}): ObjectDTO {
  return {
    id: 'obj-1',
    name: 'Room 3',
    currentVersion: 1,
    parents: [{ id: 'floor-1' }],
    properties: [
      {
        id: 'p1',
        key: 'mass',
        label: 'Mass',
        values: [{ id: 'v1', data: '2400 kg' }],
      },
    ],
    address: { street: 'Hoofdstraat', city: 'Amsterdam' },
    files: [],
    ...over,
  } as unknown as ObjectDTO
}

describe('objectToDuplicateInput', () => {
  describe('naming', () => {
    it('separates the prefix from the name with one space', () => {
      // The placeholder reads "e.g. Copy of", so the separator cannot depend on
      // the user remembering a trailing space.
      expect(
        objectToDuplicateInput(source(), { namePrefix: 'Copy of' }).name
      ).toBe('Copy of Room 3')
    })

    it('does not double the space when the prefix already ends in one', () => {
      expect(
        objectToDuplicateInput(source(), { namePrefix: 'Copy of ' }).name
      ).toBe('Copy of Room 3')
    })

    it('leaves the name alone when there is no prefix', () => {
      expect(objectToDuplicateInput(source()).name).toBe('Room 3')
      expect(objectToDuplicateInput(source(), { namePrefix: '   ' }).name).toBe(
        'Room 3'
      )
    })
  })

  describe('parents', () => {
    it('replaces the source parents rather than merging them', () => {
      // Copying a first-floor room to the second floor must not leave it on
      // both floors.
      const body = objectToDuplicateInput(source(), {
        parentIds: ['floor-2'],
      })
      expect(body.parents).toEqual(['floor-2'])
    })

    it('omits parents entirely for a root copy', () => {
      expect(objectToDuplicateInput(source(), { parentIds: [] }).parents).toBe(
        undefined
      )
    })
  })

  describe('what a copy carries', () => {
    it('copies properties by default and drops them when asked', () => {
      expect(objectToDuplicateInput(source()).properties).toHaveLength(1)
      expect(
        objectToDuplicateInput(source(), { copyProperties: false }).properties
      ).toBe(undefined)
    })

    it('copies the address by default and drops it when asked', () => {
      expect(objectToDuplicateInput(source()).address).toBeDefined()
      expect(
        objectToDuplicateInput(source(), { copyAddress: false }).address
      ).toBe(undefined)
    })
  })

  describe('files', () => {
    const withFiles = () =>
      source({
        files: [
          {
            id: 'f1',
            kind: 'reference',
            reference: { url: 'https://example.com/spec.pdf' },
            label: 'Spec',
          },
          { id: 'f2', kind: 'upload', fileName: 'photo.jpg' },
          {
            id: 'f3',
            kind: 'reference',
            reference: { url: 'https://example.com/old.pdf' },
            deleted: true,
          },
        ],
      } as unknown as Partial<ObjectDTO>)

    it('copies reference files, which are pure data', () => {
      const body = objectToDuplicateInput(withFiles())
      expect(body.files).toEqual([
        {
          kind: 'reference',
          reference: { url: 'https://example.com/spec.pdf' },
          label: 'Spec',
        },
      ])
    })

    it('never copies an upload', () => {
      // A blob has ONE `attachedTo` target, so reusing the id would leave two
      // entities pointing at a file the first still owns — deleting the
      // original would take it from the copy.
      const body = objectToDuplicateInput(withFiles())
      expect(JSON.stringify(body.files)).not.toContain('photo.jpg')
    })

    it('skips a deleted reference', () => {
      const body = objectToDuplicateInput(withFiles())
      expect(JSON.stringify(body.files)).not.toContain('old.pdf')
    })

    it('omits files entirely when copying them is off', () => {
      expect(
        objectToDuplicateInput(withFiles(), { copyFiles: false }).files
      ).toBe(undefined)
    })
  })
})
