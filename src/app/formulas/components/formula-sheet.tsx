'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { FormulaDTO } from 'io2p-client'

import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { useFormulas } from '@/hooks/api/leaves'
import { isValidExpression } from '@/lib/formula-expression'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

import { FormulaExpressionField } from './formula-expression-field'
import { UnitPicker } from './unit-picker'
import { anchor } from '@/constants'

/**
 * `duplicate` rather than `edit`, deliberately.
 *
 * A formula is IMMUTABLE — io2p has no update, and "editing" one is a new create recording
 * `copiedFrom` (D46). Every value already bound to the original keeps using it, which is the point:
 * a stored calculation cannot change under the objects that reference it. An Edit affordance would
 * name something the API cannot do and silently leave those objects behind.
 *
 * `correction` is Duplicate's twin and its opposite in meaning. Duplicate FORKS: both formulas stay
 * good. Correct is a CLAIM that the original is wrong — the node stamps it `supersededBy` in the
 * same command. Neither one recomputes anything: values bound to the original keep using it, and
 * the status is a signal for readers, never a gate. That is why it is its own affordance rather
 * than a checkbox on Duplicate.
 */
export type FormulaSheetMode = 'create' | 'duplicate' | 'correction' | 'view'

interface FormulaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: FormulaSheetMode
  /** The source for `duplicate`, and the subject for `view`. */
  formula?: FormulaDTO | null
}

export function FormulaSheet({
  open,
  onOpenChange,
  mode,
  formula = null,
}: FormulaSheetProps) {
  const t = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* The body mounts fresh on every open, so its fields seed from props at mount rather than
            being re-synced by an effect — a second Duplicate cannot inherit the first one's edits. */}
        {open &&
          (mode === 'view' ? (
            <>
              <SheetHeader className="border-b px-6 py-4 pr-12">
                <SheetTitle>{formula?.name ?? t('formulas.title')}</SheetTitle>
                <SheetDescription>
                  {formula?.supersededBy
                    ? t('formulas.supersededWarning')
                    : t('formulas.immutableNote')}
                </SheetDescription>
              </SheetHeader>
              <FormulaFacts formula={formula} />
              <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  {t('common.close')}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <FormulaForm
              mode={mode}
              formula={formula}
              onDone={() => onOpenChange(false)}
            />
          ))}
      </SheetContent>
    </Sheet>
  )
}

function FormulaForm({
  mode,
  formula,
  onDone,
}: {
  mode: Exclude<FormulaSheetMode, 'view'>
  formula: FormulaDTO | null
  onDone: () => void
}) {
  const t = useTranslations()
  const createMutation = useFormulas().useCreate()

  const seeded = (mode === 'duplicate' || mode === 'correction') && formula
  const [name, setName] = useState(() =>
    seeded
      ? mode === 'correction'
        ? formula.name
        : t('formulas.copyName', { name: formula.name })
      : ''
  )
  const [expression, setExpression] = useState(() =>
    seeded ? formula.expression : ''
  )
  // Seeded on duplicate too: a copy that dropped the declaration would send its results back to
  // the unitless bucket, one generation removed from the bug the declaration exists to fix.
  const [unit, setUnit] = useState(() => (seeded ? (formula.unit ?? '') : ''))

  const canSave =
    name.trim() !== '' &&
    isValidExpression(expression) &&
    !createMutation.isPending

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    try {
      await createMutation.mutateAsync({
        body: {
          name: name.trim(),
          expression: expression.trim(),
          ...(unit ? { unit } : {}),
          // Records the lineage so "where did this come from" is answerable later.
          ...(mode === 'duplicate' && formula
            ? { copiedFrom: formula.id }
            : {}),
          // No `copiedFrom` alongside it: the node defaults it from `correctionOf`, because a
          // correction IS lineage.
          ...(mode === 'correction' && formula
            ? { correctionOf: formula.id }
            : {}),
        },
      })
      toast.success(t('formulas.created'))
      onDone()
    } catch (error) {
      logger.error('Create formula failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-4 pr-12">
        <SheetTitle>
          {mode === 'correction'
            ? t('formulas.correctTitle')
            : mode === 'duplicate'
              ? t('formulas.duplicateTitle')
              : t('formulas.createTitle')}
        </SheetTitle>
        <SheetDescription>
          {mode === 'correction' && formula
            ? t('formulas.correctOf', { name: formula.name })
            : mode === 'duplicate' && formula
              ? t('formulas.duplicateOf', { name: formula.name })
              : t('formulas.createDescription')}
        </SheetDescription>
      </SheetHeader>

      {/* `px-1 -mx-1`: a focus ring is drawn OUTSIDE the input's box (ring + ring-offset), so a
          scroll container flush against it clips the ring on both edges — the field looks like it
          jumps out of the panel when focused. The padding gives the ring room; the negative margin
          cancels the visual indent so fields stay aligned with the header. `min-h-0` lets the
          container actually shrink, or the flex child refuses to scroll. */}
      <form
        onSubmit={submit}
        className="-mx-1 flex min-h-0 flex-1 flex-col overflow-hidden px-1"
      >
        <SheetBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="formula-name">{t('formulas.name')}</Label>
            <Input
              id="formula-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('formulas.placeholders.name')}
            />
          </div>

          {/* ABOVE the expression, full width. Beside it the column had to be narrow enough for
              the expression to stay usable, which truncated the trigger to "No u…" and turned the
              hint into a tall thin paragraph. The expression field owns a status line and the
              insert palette below it, so anything placed after that row is separated from this one
              by the whole palette. */}
          <div className="space-y-2">
            <Label htmlFor="formula-unit">{t('formulas.unit')}</Label>
            <UnitPicker id="formula-unit" value={unit} onChange={setUnit} />
            <p className="text-xs text-muted-foreground">
              {t('formulas.unitHint')}
            </p>
          </div>

          <div {...anchor('formulaExpression')}>
            <FormulaExpressionField
              value={expression}
              onChange={setExpression}
            />
          </div>
        </SheetBody>

        <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onDone}
            disabled={createMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="w-full"
            disabled={!canSave}
            data-testid="formula-submit"
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('formulas.create')}
          </Button>
        </SheetFooter>
      </form>
    </>
  )
}

/** What a saved formula is: the expression, and the variables the server derived from it. */
function FormulaFacts({ formula }: { formula: FormulaDTO | null }) {
  const t = useTranslations()
  if (!formula) return null

  return (
    <SheetBody className="space-y-5">
      <Fact label={t('formulas.expression')}>
        <code className="font-mono text-sm">{formula.expression}</code>
      </Fact>

      <Fact label={t('formulas.unit')} testId="formula-fact-unit">
        {formula.unit ? (
          <span className="font-mono text-sm">{formula.unit}</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t('formulas.unitInferred')}
          </span>
        )}
      </Fact>

      <Fact label={t('formulas.variables')}>
        {formula.variables.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            {t('objects.formulaEditor.noVariables')}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {formula.variables.map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="font-mono text-[11px]"
              >
                {v}
              </Badge>
            ))}
          </div>
        )}
      </Fact>

      <Fact label={t('common.owner')}>
        <Badge variant={formula.system ? 'outline' : 'secondary'}>
          {formula.system ? t('common.builtIn') : t('common.userCreated')}
        </Badge>
      </Fact>

      {formula.supersededBy && (
        <Fact label={t('formulas.supersededBy')}>
          <code className="font-mono text-xs text-muted-foreground">
            {formula.supersededBy}
          </code>
        </Fact>
      )}

      {formula.copiedFrom && (
        <Fact label={t('formulas.copiedFrom')}>
          <code className="font-mono text-xs text-muted-foreground">
            {formula.copiedFrom}
          </code>
        </Fact>
      )}
    </SheetBody>
  )
}

function Fact({
  label,
  children,
  testId,
}: {
  label: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <div className="space-y-1.5" data-testid={testId}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
