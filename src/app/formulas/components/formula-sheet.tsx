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
import { logger } from '@/lib/logger'

import { FormulaExpressionField } from './formula-expression-field'
import { anchor } from '@/constants'

/**
 * `duplicate` rather than `edit`, deliberately.
 *
 * A formula is IMMUTABLE — io2p has no update, and "editing" one is a new create recording
 * `copiedFrom` (D46). Every value already bound to the original keeps using it, which is the point:
 * a stored calculation cannot change under the objects that reference it. An Edit affordance would
 * name something the API cannot do and silently leave those objects behind.
 */
export type FormulaSheetMode = 'create' | 'duplicate' | 'view'

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
                  {t('formulas.immutableNote')}
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

  const seeded = mode === 'duplicate' && formula
  const [name, setName] = useState(() =>
    seeded ? t('formulas.copyName', { name: formula.name }) : ''
  )
  const [expression, setExpression] = useState(() =>
    seeded ? formula.expression : ''
  )

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
          // Records the lineage so "where did this come from" is answerable later.
          ...(mode === 'duplicate' && formula
            ? { copiedFrom: formula.id }
            : {}),
        },
      })
      toast.success(t('formulas.created'))
      onDone()
    } catch (error) {
      logger.error('Create formula failed', error)
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-4 pr-12">
        <SheetTitle>
          {mode === 'duplicate'
            ? t('formulas.duplicateTitle')
            : t('formulas.createTitle')}
        </SheetTitle>
        <SheetDescription>
          {mode === 'duplicate' && formula
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
          <Button type="submit" className="w-full" disabled={!canSave}>
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
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
