'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

import { useCancelImport, useRunImport } from '@/hooks/api/imports'
import { useImportWizard } from '@/app/import/hooks/use-import-wizard'

import { StepUpload } from './step-upload'
import { StepSheet } from './step-sheet'
import { StepMap } from './step-map'
import { StepCheck } from './step-check'
import { StepImport } from './step-import'

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
}: {
  /** No job id: `useRunImport` arms the watcher at start, not on this click. */
  onFinished?: () => void
}) {
  const t = useTranslations()
  const [step, setStep] = useState(0)
  const wizard = useImportWizard()
  const run = useRunImport()
  const discard = useCancelImport()

  const back = () => setStep((s) => Math.max(0, s - 1))
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))

  /**
   * Why Continue is unavailable, per step. Scoped to the step that OWNS the condition — one shared
   * `disabled` also blocked Sheet, which has nothing to say about names. A reason rather than a
   * boolean, so it can sit beside the button.
   */
  const blockedBecause = step === 2 ? wizard.blockedBecause : null

  // The node's dry-run problems, kept only while the run is on this screen.
  const problems = run.data?.started === false ? run.data.problems : []

  return (
    <div className="space-y-6">
      <Stepper current={step} onJump={setStep} />

      <div className="rounded-lg border bg-card p-6">
        {step === 0 && <StepUpload wizard={wizard} onParsed={next} />}
        {step === 1 && <StepSheet wizard={wizard} />}
        {step === 2 && <StepMap wizard={wizard} />}
        {step === 3 && <StepCheck wizard={wizard} />}
        {step === 4 && (
          <StepImport
            wizard={wizard}
            progress={run.progress}
            problems={problems}
            isPending={run.isPending}
            error={run.error}
            onStart={() =>
              run.mutate({
                items: wizard.items,
                ...(wizard.file ? { filename: wizard.file.name } : {}),
              })
            }
            onDone={() => {
              if (problems.length > 0) {
                // Nothing was written, so go back to the mapping, not out of the wizard. Retire
                // the draft on the way: chunk keys are positional (`${id}:${index}`), so
                // re-staging a changed mapping into this job would no-op against keys the node has
                // already seen.
                if (run.data?.started === false) discard.mutate(run.data.job.id)
                run.reset()
                setStep(2)
                return
              }
              if (run.data?.started) onFinished?.()
            }}
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
          >
            {t('common.back')}
          </Button>
          {step < STEPS.length - 1 && (
            <div className="flex items-center gap-3">
              {blockedBecause && (
                <p
                  data-testid="wizard-blocked"
                  className="text-sm text-muted-foreground"
                >
                  {t(blockedBecause.key, blockedBecause.values)}
                </p>
              )}
              <Button
                type="button"
                data-testid="wizard-next"
                onClick={next}
                disabled={Boolean(blockedBecause)}
              >
                {step === 3
                  ? t('import.actions.importCount', {
                      count: wizard.items.length,
                    })
                  : t('common.continue')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
