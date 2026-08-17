/**
 * The wizard's cascade, tested where it is cheapest: the hook.
 *
 * Every value here depends on one upstream — file → sheet → header row → mapping → items — so the
 * failures worth pinning are the ones where a downstream value quietly disagrees with the state
 * that produced it. Those render as a plausible screen, which is why they survived review.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const parseSheetFile = vi.fn()

vi.mock('@/app/import/lib/parse-sheet', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/import/lib/parse-sheet')
  >('@/app/import/lib/parse-sheet')
  return {
    ...actual,
    parseSheetFile: (...args: unknown[]) => parseSheetFile(...args),
  }
})

import { useImportWizard } from '@/app/import/hooks/use-import-wizard'
import { ATTACH_EVERY_LEVEL } from '@/app/import/lib/build-items'

// Two preamble lines, then the header, then data — the shape every municipal export has, and the
// one that makes "which row failed?" a real question.
const SHEET = {
  name: 'Sheet1',
  rows: [
    ['Objectenregister export', '', ''],
    ['Peildatum 2026-01-31', '', ''],
    ['Gebouw', 'Verdieping', 'Oppervlakte'],
    ['Noordpoort', 'BG', '24'],
    ['Noordpoort', '1e', '31'],
  ],
  rowNumbers: [1, 2, 3, 4, 5],
  suggestedHeaderRow: 2,
}

async function mounted() {
  parseSheetFile.mockResolvedValue([SHEET])
  const hook = renderHook(() => useImportWizard())
  await act(async () => {
    await hook.result.current.pickFile(new File(['x'], 'export.csv'))
  })
  await waitFor(() => expect(hook.result.current.sheet).not.toBeNull())
  return hook
}

describe('useImportWizard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts data on the row after the detected header', async () => {
    const { result } = await mounted()
    expect(result.current.headerRow).toBe(2)
    expect(result.current.dataRow).toBe(3)
    expect(result.current.headers).toEqual([
      'Gebouw',
      'Verdieping',
      'Oppervlakte',
    ])
  })

  it('refuses to start data above the header', async () => {
    const { result } = await mounted()

    // The picker offers a "data" button on the preamble rows too. Accepting row 0 swept the
    // preamble AND the header line into the data, so "Gebouw" was imported as an object.
    act(() => result.current.selectDataRow(0))

    expect(result.current.dataRow).toBe(3)
    expect(result.current.previewRows[0]).toEqual(['Noordpoort', 'BG', '24'])
  })

  it('still accepts a data row below the header', async () => {
    const { result } = await mounted()
    act(() => result.current.selectDataRow(4))
    expect(result.current.dataRow).toBe(4)
  })

  it('carries the FILE line into problems, not the offset in the data slice', async () => {
    const { result } = await mounted()

    // Blank the name on the last row so the builder refuses it. It is file line 5; counting the
    // data slice would call it row 2.
    act(() => result.current.setColumn(0, { kind: 'name' }))
    const rows = [...SHEET.rows.map((r) => [...r])]
    rows[4] = ['', '1e', '31']
    parseSheetFile.mockResolvedValue([{ ...SHEET, rows }])

    const second = renderHook(() => useImportWizard())
    await act(async () => {
      await second.result.current.pickFile(new File(['x'], 'export.csv'))
    })
    act(() => second.result.current.setColumn(0, { kind: 'name' }))

    const problem = second.result.current.problems[0]
    expect(problem?.row).toBe(5)
  })

  it('re-seeds the mapping and clears levels when the header row moves', async () => {
    const { result } = await mounted()
    act(() => result.current.toggleLevel(0))
    expect(result.current.levels).toEqual([0])

    // A different header row means different columns, so a level chosen against the old ones is
    // meaningless — keeping it would nest by a column that no longer exists.
    act(() => result.current.selectHeaderRow(1))
    expect(result.current.levels).toEqual([])
    expect(result.current.attachTo).toEqual({})
  })
})

describe('useImportWizard — address attachment', () => {
  const ADDRESSED = {
    name: 'Sheet1',
    rows: [
      ['Gebouw', 'Verdieping', 'Adres'],
      ['Noordpoort', 'BG', 'Kerkstraat 1'],
      ['Noordpoort', '1e', 'Kerkstraat 1'],
    ],
    rowNumbers: [1, 2, 3],
    suggestedHeaderRow: 0,
  }

  const withAddress = async () => {
    parseSheetFile.mockResolvedValue([ADDRESSED])
    const hook = renderHook(() => useImportWizard())
    await act(async () => {
      await hook.result.current.pickFile(new File(['x'], 'export.csv'))
    })
    await waitFor(() => expect(hook.result.current.sheet).not.toBeNull())
    return hook
  }

  beforeEach(() => vi.clearAllMocks())

  it('attaches an address to every level, not only the leaf', async () => {
    const { result } = await withAddress()
    act(() => result.current.setColumn(2, { kind: 'address' }))

    act(() => result.current.toggleLevel(0))
    act(() => result.current.toggleLevel(1))

    // Left unset the address lands on every floor and no building gets one.
    expect(result.current.attachTo[2]).toBe(ATTACH_EVERY_LEVEL)

    const addressed = result.current.items.filter(
      (item) => (item.body as { address?: unknown }).address
    )
    // The building and both of its floors — the row asserts the address for all of them.
    expect(addressed).toHaveLength(3)
  })

  it('attaches an address when the SUGGESTED hierarchy is accepted', async () => {
    const { result } = await withAddress()
    act(() => result.current.setColumn(2, { kind: 'address' }))

    // The prompt applies the whole suggestion at once rather than toggling each column, and that
    // is the path a user actually takes — seeding only on the toggle skipped it entirely.
    act(() => result.current.setLevels([0, 1]))

    expect(result.current.attachTo[2]).toBe(ATTACH_EVERY_LEVEL)
    const addressed = result.current.items.filter(
      (item) => (item.body as { address?: unknown }).address
    )
    expect(addressed).toHaveLength(3)
  })

  it('leaves a choice the user already made', async () => {
    const { result } = await withAddress()
    act(() => result.current.setColumn(2, { kind: 'address' }))
    act(() => result.current.setAttachTo((current) => ({ ...current, 2: 1 })))

    act(() => result.current.toggleLevel(0))

    expect(result.current.attachTo[2]).toBe(1)
  })

  it('does not attach a non-address column', async () => {
    const { result } = await withAddress()
    act(() =>
      result.current.setColumn(2, {
        kind: 'property',
        key: 'area',
        label: 'Area',
        split: null,
      })
    )

    act(() => result.current.toggleLevel(0))

    expect(result.current.attachTo[2]).toBeUndefined()
  })
})
