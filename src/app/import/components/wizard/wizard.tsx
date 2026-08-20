'use client'

import type { ComponentType } from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronRight, Upload } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { anchor } from '@/constants'

import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'
import { useCancelImport, useRunImport } from '@/hooks/api/imports'
import { useImportWizard } from '@/app/import/hooks/use-import-wizard'
import { sampleSheetFile } from '@/app/import/lib/sample-sheet'

import { StepUpload } from './step-upload'
import { StepSheet } from './step-sheet'
import { StepMap } from './step-map'
import { StepCheck } from './step-check'
import { StepImport, runPhase } from './step-import'

// Labels come from `import.steps.<id>`, built from the id — a prune that greps for a literal
// translator call will not see them. Do not delete that namespace by name search. (No example
// call written here on purpose: the messages test's collector would read one as a real key.)
const STEPS = [
  { id: 'upload' },
  { id: 'sheet' },
  { id: 'map' },
  { id: 'check' },
  { id: 'import' },
] as const

/**
 * The one button on the right of the footer. Every step contributes one, including the last —
 * before, the run's three buttons lived inside the card and the footer went empty there, so the
 * place you press moved on the only screen whose press cannot be undone.
 */
interface FooterAction {
  testId: string
  label: string
  onClick: () => void
  variant?: 'outline'
  icon?: ComponentType<{ className?: string }>
  disabled?: boolean
}

/** Clickable back to any step already visited, never forward. */
function Stepper({
  current,
  onJump,
}: {
  current: number
  onJump: (index: number) => void
}) {
  const t = useTranslations()
  return (
    <ol
      data-testid="wizard-stepper"
      {...anchor('importStepper')}
      className="flex flex-wrap items-center gap-1 text-sm"
    >
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step.id} className="flex items-center gap-1">
            <button
              type="button"
              data-testid={`wizard-step-${step.id}`}
              disabled={!done && !active}
              onClick={() => onJump(index)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'bg-primary/10 font-medium text-primary',
                done && 'text-muted-foreground hover:bg-muted',
                !active && !done && 'cursor-default text-muted-foreground/50'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                  active && 'border-primary bg-primary text-primary-foreground',
                  done && 'border-emerald-500 bg-emerald-500 text-white'
                )}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {t(`import.steps.${step.id}`)}
            </button>
            {index < STEPS.length - 1 && (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground/40"
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function Wizard({
  onFinished,
  onTourExit,
}: {
  /** No job id: `useRunImport` arms the watcher at start, not on this click. */
  onFinished?: () => void
  /**
   * The walkthrough stepped back off the wizard's FIRST step, so the gate that
   * has to open now is the tab — and that one belongs to the page. Lifting the
   * step counter up there instead would hand the page the wizard's internals to
   * hold on behalf of a tour.
   */
  onTourExit?: () => void
}) {
  const t = useTranslations()
  const [step, setStep] = useState(0)
  const wizard = useImportWizard()
  const run = useRunImport()
  const discard = useCancelImport()

  const back = () => setStep((s) => Math.max(0, s - 1))
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))

  /**
   * The walkthrough drives the wizard with a sample sheet.
   *
   * Every step after Upload is rendered FROM a parsed file, so a tour with no
   * file can only point at the dropzone. The sample goes in through `pickFile`
   * like any other — nothing is injected further down the cascade, so what the
   * tour walks is the real pipeline.
   *
   * `wizard.file` is the guard, not a flag of our own: it is set by exactly the
   * call below, so re-crossing the gate after stepping back cannot re-parse.
   */
  useTourAction(TOUR_ACTIONS.importAdvance, () => {
    if (wizard.file) {
      next()
      return
    }
    void wizard.pickFile(sampleSheetFile()).then((ok) => {
      if (ok) next()
    })
  })

  // Fired by the runner when the tour steps BACK over a gate. Past the wizard's
  // first step that is one step; at it, it is the tab, which the page owns.
  useTourAction(TOUR_ACTIONS.closeSheet, () => {
    if (step > 0) back()
    else onTourExit?.()
  })

  // On EVERY exit, so an escaped tour cannot leave a sample sheet sitting one
  // button away from being written to the node.
  useTourAction(TOUR_ACTIONS.resetImport, () => {
    wizard.reset()
    setStep(0)
  })

  /**
   * Why Continue is unavailable, per step. Scoped to the step that OWNS the condition — one shared
   * `disabled` also blocked Sheet, which has nothing to say about names. A reason rather than a
   * boolean, so it can sit beside the button.
   */
  const blockedBecause = step === 2 ? wizard.blockedBecause : null

  // The node's dry-run problems, kept only while the run is on this screen.
  const problems = run.data?.started === false ? run.data.problems : []
  const last = STEPS.length - 1
  const phase = runPhase({
    problems,
    progress: run.progress,
    isPending: run.isPending,
  })

  const leaveRun = () => {
    if (problems.length > 0) {
      // Nothing was written, so go back to the mapping, not out of the wizard. Retire the draft on
      // the way: chunk keys are positional (`${id}:${index}`), so re-staging a changed mapping
      // into this job would no-op against keys the node has already seen.
      if (run.data?.started === false) discard.mutate(run.data.job.id)
      run.reset()
      setStep(2)
      return
    }
    if (run.data?.started) onFinished?.()
  }

  const runAction = (): FooterAction | null => {
    switch (phase) {
      case 'refused':
        return {
          testId: 'run-back-to-mapping',
          label: t('import.run.backToMapping'),
          variant: 'outline',
          onClick: leaveRun,
        }
      case 'handedOver':
        return {
          testId: 'run-see-status',
          label: t('import.run.seeStatus'),
          onClick: leaveRun,
        }
      case 'ready':
        return {
          testId: 'run-start',
          label: t('import.actions.importCount', {
            count: wizard.items.length,
          }),
          icon: Upload,
          onClick: () =>
            run.mutate({
              items: wizard.items,
              ...(wizard.file ? { filename: wizard.file.name } : {}),
            }),
        }
      // Rows in flight: nothing to press, and a disabled button reads as a broken one.
      case 'working':
        return null
    }
  }

  /**
   * Continue says CONTINUE on every step it appears, including Check. It used to read "Import 1,847
   * objects" there and import nothing — the identical button one screen later did the writing.
   */
  const action: FooterAction | null =
    step === last
      ? runAction()
      : {
          testId: 'wizard-next',
          label: t('common.continue'),
          onClick: next,
          disabled: Boolean(blockedBecause),
        }

  return (
    <div className="space-y-6">
      <Stepper current={step} onJump={setStep} />

      <div
        className="rounded-lg border bg-card p-6"
        {...(step === last ? anchor('importRun') : {})}
      >
        {step === 0 && <StepUpload wizard={wizard} onParsed={next} />}
        {step === 1 && <StepSheet wizard={wizard} />}
        {step === 2 && <StepMap wizard={wizard} />}
        {step === 3 && <StepCheck wizard={wizard} />}
        {step === 4 && (
          <StepImport
            wizard={wizard}
            phase={phase}
            progress={run.progress}
            problems={problems}
            error={run.error}
          />
        )}
      </div>

      {/* Upload has no Next — picking a file IS the action, and a disabled Next beside a dropzone
          is a second thing to look at that never becomes the thing you press. */}
      {step > 0 && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            data-testid="wizard-back"
            onClick={back}
            // Leaving mid-upload does not stop the upload, and the rows already staged keep their
            // positional chunk keys — coming back with a changed mapping would silently no-op.
            disabled={step === last && phase === 'working'}
          >
            {t('common.back')}
          </Button>
          <div className="flex items-center gap-3">
            {blockedBecause && (
              <p
                data-testid="wizard-blocked"
                className="text-sm text-muted-foreground"
              >
                {t(blockedBecause.key, blockedBecause.values)}
              </p>
            )}
            {action && (
              <Button
                type="button"
                data-testid={action.testId}
                variant={action.variant}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(action.icon && 'gap-2')}
              >
                {action.icon && <action.icon className="h-4 w-4" />}
                {action.label}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
