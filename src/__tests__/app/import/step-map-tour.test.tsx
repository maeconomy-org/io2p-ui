/**
 * The mapper under a walkthrough.
 *
 * This screen is the reason the tour needs actions at all. The hierarchy box and
 * the applied-hierarchy bar are mutually exclusive — one renders while no
 * hierarchy is set, the other while one is — and so is the per-column "attaches
 * to" select. Pointing alone can never show the second half.
 *
 * Driven through the REAL wizard and the real suggester, because what is under
 * test is that the four actions reach the states the tour's copy describes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'

import { StepMap } from '@/app/import/components/wizard/step-map'
import { useImportWizard } from '@/app/import/hooks/use-import-wizard'
import { sampleSheetFile } from '@/app/import/lib/sample-sheet'
import { TOUR_ACTION_EVENT } from '@/components/onboarding/constants'
import { TOUR_ACTIONS } from '@/components/onboarding/use-tour-action'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function Harness() {
  const wizard = useImportWizard()
  return (
    <>
      <button
        type="button"
        data-testid="load"
        onClick={() => void wizard.pickFile(sampleSheetFile())}
      />
      {wizard.sheet ? <StepMap wizard={wizard} /> : null}
    </>
  )
}

const fire = (action: string) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(TOUR_ACTION_EVENT, { detail: { action } })
    )
  })

const mounted = async () => {
  render(<Harness />)
  await act(async () => {
    screen.getByTestId('load').click()
  })
  await waitFor(() => expect(screen.getByTestId('map-suggest')).toBeVisible())
}

beforeEach(() => vi.clearAllMocks())

describe('the mapper under a walkthrough', () => {
  it('offers to look for a hierarchy, without proposing one', async () => {
    await mounted()

    // Never volunteered: a suggestion that arrived on its own was wrong on ten
    // of sixteen sheets of a real municipal register.
    expect(screen.queryByTestId('map-suggest-effect')).toBeNull()
  })

  it('reveals the proposal, with the count the step points at', async () => {
    await mounted()

    fire(TOUR_ACTIONS.importSuggestLevels)

    // The copy says "judge it by this number". If the effect line is missing,
    // that step highlights nothing for the full waitForElement timeout.
    expect(screen.getByTestId('map-suggest-effect')).toBeVisible()
    expect(screen.getByTestId('map-suggest-accept')).toBeVisible()
  })

  it('applies the hierarchy and swaps the box for the summary', async () => {
    await mounted()
    fire(TOUR_ACTIONS.importSuggestLevels)

    fire(TOUR_ACTIONS.importApplyLevels)

    expect(screen.getByTestId('map-level-summary')).toBeVisible()
    // The pair, in the other direction: the box is gone, so a step still
    // pointing at it would hang.
    expect(screen.queryByTestId('map-suggest')).toBeNull()
    expect(screen.queryByTestId('map-suggest-effect')).toBeNull()
  })

  /**
   * The third dropdown, which the "what changed" step describes by name. It does
   * not exist until a hierarchy is applied — that is the whole reason the tour
   * applies one.
   */
  it('gives every non-level column an attaches-to select', async () => {
    await mounted()
    fire(TOUR_ACTIONS.importSuggestLevels)

    fire(TOUR_ACTIONS.importApplyLevels)

    expect(screen.getAllByTestId(/^map-attach-\d+$/).length).toBeGreaterThan(0)
  })

  it('undoes the acceptance when the tour steps back over it', async () => {
    await mounted()
    fire(TOUR_ACTIONS.importSuggestLevels)
    fire(TOUR_ACTIONS.importApplyLevels)

    fire(TOUR_ACTIONS.importClearLevels)

    // Back to the step before, with its anchor present again.
    expect(screen.getByTestId('map-suggest-effect')).toBeVisible()
    expect(screen.queryByTestId('map-level-summary')).toBeNull()
  })

  it('undoes the ask when the tour steps back over that too', async () => {
    await mounted()
    fire(TOUR_ACTIONS.importSuggestLevels)

    fire(TOUR_ACTIONS.importHideSuggestion)

    expect(screen.getByTestId('map-suggest')).toBeVisible()
    expect(screen.queryByTestId('map-suggest-effect')).toBeNull()
  })

  it('always shows a target select, hierarchy or not', async () => {
    await mounted()

    // The "one row per column" step describes this one, and it is the only
    // control on the row that is never conditional.
    expect(screen.getByTestId('map-target-0')).toBeVisible()
  })
})
