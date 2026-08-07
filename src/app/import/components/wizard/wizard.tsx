'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

import { useCancelImport, useRunImport } from '@/hooks/api/imports'
import { useImportWizard } from '@/hooks/import/use-import-wizard'

import { StepUpload } from './step-upload'
import { StepSheet } from './step-sheet'
import { StepMap } from './step-map'
import { StepCheck } from './step-check'
import { StepImport } from './step-import'

/**
 * Five steps, not six.
 *
 * `Structure` was a separate step while hierarchy was chosen apart from mapping. Once a level is
 * just another thing a column can be, declaring it belongs with every other column decision — and
 * the tree it produces is already visible in Check, where the rows are the objects themselves.
 */
// Labels come from `import.steps.<id>`, built from the id — so a prune that only greps for a
// literal translator call will not see them. Do not delete that namespace by name search.
// (Written without an example call on purpose: the usage collector in the messages test would
// read one in a comment as a real key, which is exactly the false positive it just caught.)
const STEPS = [
  { id: 'upload' },
  { id: 'sheet' },
  { id: 'map' },
  { id: 'check' },
  { id: 'import' },
] as const

/**
 * Clickable back to any step already visited, never forward.
 *
 * Today's stepper is decoration — the only way back is a Back button at the bottom of the page,
 * so correcting the header row from the preview means two blind clicks. A step you have completed
 * is a place you can return to; a step you have not is not yet meaningful.
 */
function Stepper({
  current,
  onJump,
}: {
  current: number
  onJump: (index: number) => void
}) {
  const t = useTranslations()
  return (
    <ol className="flex flex-wrap items-center gap-1 text-sm">
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step.id} className="flex items-center gap-1">
            <button
              type="button"
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
   * Why Continue is unavailable, per step — and `null` when it is fine.
   *
   * The condition has to be scoped to the step that owns it. A single shared `disabled` blocked
   * the Sheet step too, which has nothing to say about names: a dead button on a screen with no
   * visible problem. Returning the REASON rather than a boolean also forces it to be sayable, so
   * it can be shown next to the button instead of left to be guessed at.
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
                // Refused: nothing was written, so send them back to the mapping rather than out
                // of the wizard. Retire the draft on the way — the next attempt has to `create` a
                // fresh job, because chunk keys are positional (`${id}:${index}`) and re-staging a
                // changed mapping into this one would no-op against keys the node has seen. Left
                // alone it lingers as a fully-staged draft the list offers a doomed Start on.
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
          <Button type="button" variant="outline" onClick={back}>
            {t('common.back')}
          </Button>
          {step < STEPS.length - 1 && (
            <div className="flex items-center gap-3">
              {blockedBecause && (
                <p className="text-sm text-muted-foreground">
                  {t(blockedBecause.key, blockedBecause.values)}
                </p>
              )}
              <Button
                type="button"
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
