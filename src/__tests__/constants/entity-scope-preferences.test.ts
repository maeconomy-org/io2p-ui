import { describe, it, expect } from 'vitest'

import { ENTITY_SCOPES, PREFERENCES } from '@/constants/preferences'

const SCOPE_KEYS = [
  'objectsScope',
  'processScope',
  'formulaScope',
  'constantScope',
  'templateScope',
] as const

describe('the per-view scope preferences', () => {
  it('defaults every list to the whole slice', () => {
    // A user who has not found the filter should see everything they can, not silently miss shared
    // work. Narrowing is a choice, and for the library `mine` would hide the node's built-ins.
    for (const key of SCOPE_KEYS) {
      expect(PREFERENCES[key].default).toBe('all')
    }
  })

  it('stores them apart from the view keys', () => {
    for (const key of SCOPE_KEYS) {
      expect(PREFERENCES[key].ns).toBe('defaults')
    }
  })

  it('accepts every slice the list endpoint takes, and nothing else', () => {
    for (const key of SCOPE_KEYS) {
      for (const scope of ENTITY_SCOPES) {
        expect(PREFERENCES[key].validate(scope)).toBe(true)
      }
      expect(PREFERENCES[key].validate('everything')).toBe(false)
      expect(PREFERENCES[key].validate(undefined)).toBe(false)
    }
  })
})
