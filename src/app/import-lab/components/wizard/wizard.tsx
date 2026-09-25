'use client'

import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

import type { LabMapping } from '../../wizard-fixtures'
import { INITIAL_MAPPING } from '../../wizard-fixtures'
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
const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'sheet', label: 'Sheet' },
  { id: 'map', label: 'Map columns' },
  { id: 'check', label: 'Check' },
  { id: 'import', label: 'Import' },
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
              {step.label}
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

export function Wizard() {
  const [step, setStep] = useState(0)
  const [mapping, setMapping] = useState<LabMapping>(INITIAL_MAPPING)
  const [sheet, setSheet] = useState('Rooms')

  const back = () => setStep((s) => Math.max(0, s - 1))
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))

  const named =
    (mapping.hierarchyMode === 'levels' && mapping.levels.length > 0) ||
    mapping.name !== null

  /**
   * Why Continue is unavailable, per step — and `null` when it is fine.
   *
   * The condition has to be scoped to the step that owns it. A single `disabled={!named}` shared
   * across the footer blocked the Sheet step too, which has nothing to say about names: a dead
   * button on a screen with no visible problem. Returning the REASON rather than a boolean also
   * forces it to be sayable, so it can be shown next to the button instead of left to be guessed.
   */
  const blockedBecause =
    step === 2 && !named
      ? 'Map a column to Name, or pick a hierarchy first'
      : null

  return (
    <div className="space-y-6">
      <Stepper current={step} onJump={setStep} />

      <div className="rounded-lg border bg-card p-6">
        {step === 0 && <StepUpload onPick={next} />}
        {step === 1 && <StepSheet selected={sheet} onSelect={setSheet} />}
        {step === 2 && <StepMap mapping={mapping} onChange={setMapping} />}
        {step === 3 && <StepCheck mapping={mapping} />}
        {step === 4 && <StepImport />}
      </div>

      {/* Upload has no Next — picking a file IS the action, and a disabled Next beside a dropzone
          is a second thing to look at that never becomes the thing you press. */}
      {step > 0 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={back}>
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <div className="flex items-center gap-3">
              {blockedBecause && (
                <p className="text-sm text-muted-foreground">
                  {blockedBecause}
                </p>
              )}
              <Button
                type="button"
                onClick={next}
                disabled={Boolean(blockedBecause)}
              >
                {step === 3 ? 'Import 1,847 objects' : 'Continue'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
