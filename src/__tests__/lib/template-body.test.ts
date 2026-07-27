import { describe, it, expect } from 'vitest'
import type { TemplateDTO } from 'io2p-client'

import {
  templateToDraft,
  buildCreateTemplateInput,
  buildUpdateTemplateBody,
} from '@/lib/template-body'

const TEMPLATE = {
  id: 'tpl-1',
  type: 'object',
  name: 'Wall',
  description: 'A wall',
  version: '1.0',
  system: false,
  currentVersion: 3,
  createdAt: 1,
  updatedAt: 2,
  createdBy: 'u1',
  deleted: false,
  properties: [
    {
      id: 'p1',
      key: 'height',
      label: 'Height',
      values: [{ id: 'v1', data: '3', source: 'authored' }],
    },
  ],
} as unknown as TemplateDTO

describe('templateToDraft', () => {
  /**
   * A template save replaces the whole tree, so every id the read returned stops existing the moment
   * it is written. Carrying them into the draft would leave the UI holding stale ids and imply a
   * soft-delete the replace model cannot express.
   */
  it('drops server ids', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.properties[0].id).toBeUndefined()
    expect(draft.properties[0].values[0].id).toBeUndefined()
  })

  // `ref` is how a calc binds a sibling within one request. Without carrying the old id across as a
  // ref, every held formula binding would dangle after the replace.
  it('keeps each value reachable by ref, using its former id', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.properties[0].values[0].ref).toBe('v1')
  })

  it('carries the authored version label and leaves the object facets unset', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.version).toBe('1.0')
    expect(draft.parentIds).toEqual([])
    expect(draft.address).toBeNull()
  })
})

describe('buildCreateTemplateInput', () => {
  it('defaults to an object template and carries the authored fields', () => {
    const body = buildCreateTemplateInput(templateToDraft(TEMPLATE))

    expect(body.type).toBe('object')
    expect(body.name).toBe('Wall')
    expect(body.version).toBe('1.0')
    expect(body.properties).toHaveLength(1)
  })

  it('omits a property with no key rather than sending a nameless one', () => {
    const body = buildCreateTemplateInput({
      ...templateToDraft(TEMPLATE),
      properties: [{ key: '  ', values: [{ data: 'orphan' }] }],
    })

    expect(body.properties).toBeUndefined()
  })
})

describe('buildUpdateTemplateBody', () => {
  it('is a no-op when nothing changed', () => {
    const body = buildUpdateTemplateBody(TEMPLATE, templateToDraft(TEMPLATE))

    expect(body).toEqual({})
  })

  it('sends only the scalar that changed', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.name = 'Wall B'

    expect(buildUpdateTemplateBody(TEMPLATE, draft)).toEqual({ name: 'Wall B' })
  })

  // Replacement, not diff: one edited value re-sends the whole collection.
  it('replaces the whole property collection when any part of it changed', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.properties[0].values[0].data = '4'

    const body = buildUpdateTemplateBody(TEMPLATE, draft)
    expect(body.properties).toHaveLength(1)
    expect(body.properties?.[0].values?.[0].data).toBe('4')
    expect(body.name).toBeUndefined()
  })

  it('drops a removed property by omitting it from the replacement', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.properties = []

    expect(buildUpdateTemplateBody(TEMPLATE, draft).properties).toEqual([])
  })

  it('clears a description the user emptied', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.description = ''

    expect(buildUpdateTemplateBody(TEMPLATE, draft).description).toBe('')
  })

  // A removed reference produces an empty `add` list either way, so absence has to be detected
  // against the BEFORE state — otherwise deleting the last file would look like no change at all.
  it('replaces files when one was removed, even though the built list is empty', () => {
    const before = {
      ...TEMPLATE,
      files: [{ id: 'f1', kind: 'reference', reference: { url: 'https://x' } }],
    } as unknown as TemplateDTO
    const draft = templateToDraft(before)
    draft.files = []

    expect(buildUpdateTemplateBody(before, draft).files).toEqual([])
  })
})
