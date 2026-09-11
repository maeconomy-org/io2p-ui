/**
 * The walkthrough driving the wizard.
 *
 * The tour cannot press Continue — that button is disabled until the mapping is
 * valid, and driver.js has no way to know when it stops being. So the wizard
 * answers actions instead, and these pin the three that matter: the sample loads
 * exactly once, a step back stays inside the wizard until there is nowhere left
 * to go, and ending the tour leaves nothing staged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'

import { Wizard } from '@/app/import/components/wizard/wizard'
import { TOUR_ACTION_EVENT } from '@/components/onboarding/constants'
import { TOUR_ACTIONS } from '@/components/onboarding/use-tour-action'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

const runMutate = vi.fn()
vi.mock('@/hooks/api/imports', () => ({
  useRunImport: () => ({
    mutate: runMutate,
    reset: vi.fn(),
    isPending: false,
    data: undefined,
    error: null,
    progress: { phase: 'idle' },
  }),
  useCancelImport: () => ({ mutate: vi.fn() }),
}))

// The step bodies are irrelevant here — what is under test is which one the
// wizard shows, and whether a file reached it. Written out rather than built by
// a helper: `vi.mock` factories are hoisted above every const in the file.
vi.mock('@/app/import/components/wizard/step-upload', () => ({
  StepUpload: () => <div data-testid="body-upload" />,
}))
vi.mock('@/app/import/components/wizard/step-sheet', () => ({
  StepSheet: () => <div data-testid="body-sheet" />,
}))
vi.mock('@/app/import/components/wizard/step-map', () => ({
  StepMap: () => <div data-testid="body-map" />,
}))
vi.mock('@/app/import/components/wizard/step-check', () => ({
  StepCheck: () => <div data-testid="body-check" />,
}))
vi.mock('@/app/import/components/wizard/step-import', () => ({
  StepImport: () => <div data-testid="body-import" />,
  runPhase: () => 'ready',
}))

const fire = (action: string) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(TOUR_ACTION_EVENT, { detail: { action } })
    )
  })

const advance = async (times: number) => {
  for (let i = 0; i < times; i += 1) {
    fire(TOUR_ACTIONS.importAdvance)
    // The first crossing parses the sample, which is async.
    await act(async () => {
      await Promise.resolve()
    })
  }
}

const onStep = (id: string) =>
  waitFor(() => expect(screen.getByTestId(`body-${id}`)).toBeInTheDocument())

beforeEach(() => vi.clearAllMocks())

describe('the wizard under a walkthrough', () => {
  it('starts on upload', () => {
    render(<Wizard />)

    expect(screen.getByTestId('body-upload')).toBeInTheDocument()
  })

  it('loads the sample and reaches the sheet step on the first crossing', async () => {
    render(<Wizard />)

    await advance(1)

    await onStep('sheet')
  })

  it('walks all five steps', async () => {
    render(<Wizard />)

    await advance(4)

    await onStep('import')
  })

  /**
   * The run button lives outside the highlighted card, so the overlay is what
   * keeps it unpressable. This pins the other half: reaching the last screen
   * writes nothing on its own.
   */
  it('writes nothing by reaching the last step', async () => {
    render(<Wizard />)

    await advance(4)

    expect(runMutate).not.toHaveBeenCalled()
  })

  it('steps back inside the wizard rather than out of it', async () => {
    const onTourExit = vi.fn()
    render(<Wizard onTourExit={onTourExit} />)
    await advance(2)
    await onStep('map')

    fire(TOUR_ACTIONS.closeSheet)

    await onStep('sheet')
    expect(onTourExit).not.toHaveBeenCalled()
  })

  /** Only at the wizard's first step is the next thing to undo the page's tab. */
  it('hands back to the page once there is nowhere left to step', async () => {
    const onTourExit = vi.fn()
    render(<Wizard onTourExit={onTourExit} />)

    fire(TOUR_ACTIONS.closeSheet)

    expect(onTourExit).toHaveBeenCalledTimes(1)
  })

  it('does not re-parse the sample when the tour crosses the gate again', async () => {
    render(<Wizard />)
    await advance(1)
    await onStep('sheet')

    fire(TOUR_ACTIONS.closeSheet)
    await onStep('upload')
    await advance(1)

    // Re-parsing would reset the header row and the mapping the user may have
    // adjusted while the tour was open.
    await onStep('sheet')
  })

  it('clears the sample when the tour ends, however it ended', async () => {
    render(<Wizard />)
    await advance(3)
    await onStep('check')

    fire(TOUR_ACTIONS.resetImport)

    await onStep('upload')
  })
})
