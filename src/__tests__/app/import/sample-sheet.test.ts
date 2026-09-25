/**
 * The sample the walkthrough imports, run through the REAL cascade.
 *
 * The tour advances the wizard by calling `next()` directly, which does not
 * consult `blockedBecause` the way the Continue button does. So a sample the
 * suggester cannot map produces no visible error — the tour simply walks into a
 * Check step that builds nothing and a Run step that can never run.
 *
 * Nothing else in the app would catch that: the columns are a plain string, the
 * suggester's rules are data, and the two agree only by construction.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import { useImportWizard } from '@/app/import/hooks/use-import-wizard'
import {
  SAMPLE_SHEET_NAME,
  sampleSheetFile,
} from '@/app/import/lib/sample-sheet'

const loaded = async () => {
  const { result } = renderHook(() => useImportWizard())
  await act(async () => {
    await result.current.pickFile(sampleSheetFile())
  })
  await waitFor(() => expect(result.current.sheet).not.toBeNull())
  return result
}

describe('the walkthrough sample sheet', () => {
  it('is named .csv, which is what the parser dispatches on', () => {
    // `parseSheetFile` reads the extension and nothing else. A rename to
    // `sample-sheet` or `.txt` throws "unsupported" from inside the tour.
    expect(SAMPLE_SHEET_NAME.endsWith('.csv')).toBe(true)
    expect(sampleSheetFile().name).toBe(SAMPLE_SHEET_NAME)
  })

  it('parses into a single sheet with the header on the first row', async () => {
    const result = await loaded()

    expect(result.current.sheets).toHaveLength(1)
    expect(result.current.headerRow).toBe(0)
    expect(result.current.headers).toContain('Name')
  })

  /** The invariant the whole tour rests on. */
  it('is never blocked, so every step of the tour has something to show', async () => {
    const result = await loaded()

    expect(result.current.blockedBecause).toBeNull()
    expect(result.current.items.length).toBeGreaterThan(0)
  })

  it('maps a name column, which is what unblocks it', async () => {
    const result = await loaded()

    const targets = Object.values(result.current.mapping.columns)
    expect(targets.some((target) => target.kind === 'name')).toBe(true)
  })

  /**
   * The map step's popover points at the hierarchy offer by name. Without
   * repeating columns there is no offer, and the step describes an empty box.
   */
  it('offers a hierarchy for the map step to point at', async () => {
    const result = await loaded()

    expect(result.current.suggestedLevels.length).toBeGreaterThan(0)
  })

  /** Offered, not applied — the tour says so, and the copy must stay true. */
  it('arrives with no hierarchy applied', async () => {
    const result = await loaded()

    expect(result.current.levels).toEqual([])
  })

  it('is small enough to read on one screen', async () => {
    const result = await loaded()

    expect(result.current.dataRows.length).toBeLessThanOrEqual(12)
  })

  it('leaves nothing behind when the tour resets it', async () => {
    const result = await loaded()

    act(() => result.current.reset())

    expect(result.current.file).toBeNull()
    expect(result.current.sheet).toBeNull()
    expect(result.current.items).toEqual([])
  })
})
