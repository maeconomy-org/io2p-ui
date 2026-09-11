import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import ImportPage from '@/app/import/page'
import { TOUR_ACTION_EVENT } from '@/components/onboarding/constants'
import { TOUR_ACTIONS } from '@/components/onboarding/use-tour-action'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/onboarding/page-help', () => ({
  PageHelp: () => null,
}))

vi.mock('@/app/import/components/job-list', () => ({
  JobList: () => <div data-testid="stub-job-list" />,
}))
vi.mock('@/app/import/components/job-detail', () => ({
  JobDetail: () => null,
}))
// The real Wizard owns every crossing INSIDE itself and reports back only when
// the tour steps past its first step. The stub exposes that one call.
vi.mock('@/app/import/components/wizard/wizard', () => ({
  Wizard: ({ onTourExit }: { onTourExit?: () => void }) => (
    <button type="button" data-testid="stub-tour-exit" onClick={onTourExit}>
      wizard
    </button>
  ),
}))

const fire = (action: string) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(TOUR_ACTION_EVENT, { detail: { action } })
    )
  })

beforeEach(() => vi.clearAllMocks())

/**
 * The import wizard is a TAB, and `forceMount`ed — so `querySelector` finds
 * every anchor inside it while it is `display: none` and measures 0x0. That is
 * why the tour has to gate on an action here exactly as it does on a sheet, and
 * why both directions matter.
 */
describe('import page — the tour gate', () => {
  it('starts on the status tab', () => {
    render(<ImportPage />)

    expect(screen.getByTestId('import-tab-status')).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  it('opens the wizard when the tour asks for it', () => {
    render(<ImportPage />)

    fire(TOUR_ACTIONS.startImport)

    expect(screen.getByTestId('import-tab-wizard')).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  /**
   * The reverse leg, which is not optional. Radix unmounts the status tab, so a
   * tour stepping BACK over the gate would land on `importJobs` — an anchor that
   * no longer exists — and sit there for the full `waitForElement` timeout.
   */
  it('returns to the status tab when the wizard reports the tour left it', () => {
    render(<ImportPage />)
    fire(TOUR_ACTIONS.startImport)

    act(() => {
      screen.getByTestId('stub-tour-exit').click()
    })

    expect(screen.getByTestId('import-tab-status')).toHaveAttribute(
      'data-state',
      'active'
    )
    expect(screen.getByTestId('stub-job-list')).toBeInTheDocument()
  })

  // The page must NOT answer this one, or a step back inside the wizard would
  // also throw the user out to the status tab.
  it('leaves the back action to the wizard', () => {
    render(<ImportPage />)
    fire(TOUR_ACTIONS.startImport)

    fire(TOUR_ACTIONS.closeSheet)

    expect(screen.getByTestId('import-tab-wizard')).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  it('ignores an action meant for another page', () => {
    render(<ImportPage />)

    fire(TOUR_ACTIONS.createObject)

    expect(screen.getByTestId('import-tab-status')).toHaveAttribute(
      'data-state',
      'active'
    )
  })
})
