import { describe, expect, it } from 'vitest'

import { faultStands } from '@/app/import/components/wizard/step-check-editable'

describe('faultStands', () => {
  it('stands on an untouched cell that already has text', () => {
    // `B-12` is a key another row also used; `Blok Q` names no row. Both hold text.
    expect(faultStands('B-12', undefined)).toBe(true)
    expect(faultStands('Blok Q', undefined)).toBe(true)
  })

  it('stands on an untouched blank cell', () => {
    expect(faultStands('', undefined)).toBe(true)
  })

  it('clears when the cell is edited to a different value', () => {
    expect(faultStands('B-12', 'B-13')).toBe(false)
    expect(faultStands('', 'Noordpoort')).toBe(false)
  })

  it('stands when the edit changes nothing', () => {
    expect(faultStands('B-12', 'B-12')).toBe(true)
    expect(faultStands('B-12', '  B-12  ')).toBe(true)
  })

  it('stands when the edit is blank', () => {
    expect(faultStands('B-12', '')).toBe(true)
    expect(faultStands('B-12', '   ')).toBe(true)
  })
})
