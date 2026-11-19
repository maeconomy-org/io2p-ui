import { describe, it, expect } from 'vitest'

import {
  PREFERENCES,
  PREF_FLAG,
  PREF_KEY_RE,
  PREF_MAX_KEYS_PER_NS,
  flagKey,
} from '@/constants/preferences'
import en from '@/messages/en.json'

const CONCEPTS = Object.keys(en.concepts)

describe('preference keys stay inside the node envelope', () => {
  // The node rejects anything outside `^[a-zA-Z][\w-]{0,63}$` with a 422, and a
  // dot would silently split into a deeper Mongo path.
  it('every registry key and namespace is a legal identifier', () => {
    for (const [key, spec] of Object.entries(PREFERENCES)) {
      expect(spec.ns).toMatch(PREF_KEY_RE)
      expect(spec.key ?? key).toMatch(PREF_KEY_RE)
    }
  })

  it('every hint flag key is a legal identifier', () => {
    for (const concept of CONCEPTS) {
      expect(flagKey(PREF_FLAG.hint, concept)).toMatch(PREF_KEY_RE)
    }
  })

  /**
   * The onboarding namespace holds one key per concept plus `toursSeen` and
   * `onboardingEpoch`. Both families are closed sets shipped in code, so usage
   * cannot grow them — only a code change can, and this is what catches it.
   */
  it('the onboarding namespace stays under the per-namespace cap', () => {
    const onboardingStatic = Object.values(PREFERENCES).filter(
      (spec) => spec.ns === 'onboarding'
    ).length
    expect(CONCEPTS.length + onboardingStatic).toBeLessThanOrEqual(
      PREF_MAX_KEYS_PER_NS
    )
  })
})
