'use client'

import { useId, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'

import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { OwnerCell, formatTimestamp } from '@/components/entity-list'
import { PropertyNameCombobox } from '@/components/entity-sheet/fields'
import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import { cn } from '@/lib/utils'
import { iomStatus } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

import { useRollupRules } from '../hooks/use-rollup-rules'
import type { RollupRuleDTO } from 'io2p-client'

import { rollupRuleErrorMessage } from '../lib/errors'
import {
  normalizeRollupPropertyKey,
  ROLLUP_AGGREGATIONS,
  type RollupAggregation,
} from '../lib/rollup-rule'

export type RollupRuleSheetMode = 'create' | 'view'

interface RollupRuleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RollupRuleSheetMode
  /** The subject for `view`. */
  rule?: RollupRuleDTO | null
}

export function RollupRuleSheet({
  open,
  onOpenChange,
  mode,
  rule = null,
}: RollupRuleSheetProps) {
  const t = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>
            {mode === 'view'
              ? (rule?.propertyKey ?? t('rollupRules.title'))
              : t('rollupRules.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {mode === 'view'
              ? t('rollupRules.keyImmutable')
              : t('rollupRules.createDescription')}
          </SheetDescription>
        </SheetHeader>

        {/* Mounts fresh per open, so the fields seed at mount rather than being re-synced by an
            effect — the same guard the constant sheet needs. */}
        {open &&
          (mode === 'view' && rule ? (
            <RollupRuleView rule={rule} onDone={() => onOpenChange(false)} />
          ) : (
            <RollupRuleForm onDone={() => onOpenChange(false)} />
          ))}
      </SheetContent>
    </Sheet>
  )
}

/** Per-key outcome of a submit, so a partial run can show which keys are still outstanding. */
type KeyFailure = { key: string; message: string }

/**
 * Create N rules in one pass: many property keys, one aggregation.
 *
 * The reverse — one key under several aggregations — is not offered because it cannot exist: the
 * node keys the uniqueness conflict on `propertyKey` alone, so a second rule for the same key is a
 * 409 whatever it aggregates.
 */
function RollupRuleForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations()
  const fieldId = useId()

  const { useOwnRules, useCreate } = useRollupRules()
  const { data: ownRules } = useOwnRules()
  const createMutation = useCreate()

  const [draft, setDraft] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [aggregation, setAggregation] = useState<RollupAggregation>(
    ROLLUP_AGGREGATIONS[0]
  )
  const [failures, setFailures] = useState<KeyFailure[]>([])

  const takenKeys = useMemo(
    () => new Set((ownRules?.data ?? []).map((r) => r.propertyKey)),
    [ownRules]
  )

  const normalizedDraft = normalizeRollupPropertyKey(draft)
  // Only when the two differ: echoing an unchanged key would be noise on every keystroke.
  const showNormalized = normalizedDraft !== '' && normalizedDraft !== draft
  const draftExists = normalizedDraft !== '' && takenKeys.has(normalizedDraft)
  const draftQueued = keys.includes(normalizedDraft)
  const canAdd = normalizedDraft !== '' && !draftExists && !draftQueued

  const canSave = keys.length > 0 && !createMutation.isPending

  const addKey = () => {
    if (!canAdd) return
    setKeys((current) => [...current, normalizedDraft])
    setDraft('')
    setFailures([])
  }

  const removeKey = (key: string) => {
    setKeys((current) => current.filter((k) => k !== key))
    setFailures((current) => current.filter((f) => f.key !== key))
  }

  /**
   * Sequential, and it does NOT stop at the first rejection.
   *
   * The keys are independent creates, so aborting would leave an unknown subset applied with no way
   * to tell which. Each failure is kept against its key and the successes drop out of the list, so
   * re-submitting retries exactly what is left. A 401 is the one abort: the remaining calls would
   * each fail the same way and each raise their own toast.
   */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return

    const created: string[] = []
    const failed: KeyFailure[] = []

    for (const key of keys) {
      try {
        await createMutation.mutateAsync({
          body: { propertyKey: key, aggregation },
        })
        created.push(key)
      } catch (error) {
        logger.error('Create rollup rule failed', {
          err: error,
          propertyKey: key,
        })
        const { key: messageKey, values } = rollupRuleErrorMessage(error)
        failed.push({ key, message: t(messageKey, values) })
        if (iomStatus(error) === 401) break
      }
    }

    const outstanding = keys.filter((key) => !created.includes(key))
    setKeys(outstanding)
    setFailures(failed)

    if (failed.length === 0) {
      toast.success(t('rollupRules.created', { count: created.length }))
      onDone()
      return
    }
    if (created.length === 0) {
      toast.error(failed[0].message)
      return
    }
    toast.warning(
      t('rollupRules.createdPartial', {
        created: created.length,
        failed: failed.length,
      })
    )
  }

  const hintId = `${fieldId}-hint`

  return (
    <form
      onSubmit={submit}
      className="-mx-1 flex min-h-0 flex-1 flex-col overflow-hidden px-1"
    >
      <SheetBody className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={fieldId}>{t('rollupRules.propertyKeys')}</Label>
          <div className="flex items-start gap-2">
            <PropertyNameCombobox
              id={fieldId}
              value={draft}
              onChange={(key) => setDraft(key)}
              placeholder={t('rollupRules.placeholders.propertyKey')}
              aria-invalid={draftExists || draftQueued}
              aria-describedby={hintId}
              data-testid="rollup-rule-property-key"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!canAdd}
              onClick={addKey}
              data-testid="rollup-rule-add-key"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('rollupRules.addKey')}
            </Button>
          </div>

          <div id={hintId} className="space-y-1">
            {showNormalized && (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.normalizedAs', { key: normalizedDraft })}
              </p>
            )}
            {draftExists ? (
              <p className="text-xs text-destructive">
                {t('rollupRules.duplicateKey')}
              </p>
            ) : draftQueued ? (
              <p className="text-xs text-destructive">
                {t('rollupRules.alreadyQueued')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.propertyKeyHint')}
              </p>
            )}
          </div>
        </div>

        {keys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('rollupRules.queued', { count: keys.length })}
            </p>
            <ul
              className="flex flex-wrap gap-1.5"
              data-testid="rollup-rule-queued-keys"
            >
              {keys.map((key) => {
                const failure = failures.find((f) => f.key === key)
                return (
                  <li key={key}>
                    <Badge
                      variant={failure ? 'outline' : 'secondary'}
                      className={cn(
                        'h-6 gap-1 pl-2 pr-1',
                        failure && 'border-destructive text-destructive'
                      )}
                      title={failure?.message}
                    >
                      {key}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                        aria-label={t('rollupRules.removeKey', { key })}
                        onClick={() => removeKey(key)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </li>
                )
              })}
            </ul>
            {failures.length > 0 && (
              <ul className="space-y-0.5">
                {failures.map((failure) => (
                  <li key={failure.key} className="text-xs text-destructive">
                    {failure.key}: {failure.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-aggregation`}>
            {t('rollupRules.aggregation')}
          </Label>
          <Select
            value={aggregation}
            onValueChange={(next) => setAggregation(next as RollupAggregation)}
          >
            <SelectTrigger
              id={`${fieldId}-aggregation`}
              data-testid="rollup-rule-aggregation"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLLUP_AGGREGATIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`rollupRules.aggregations.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('rollupRules.aggregationHint')}
          </p>
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
          data-testid="rollup-rule-submit"
        >
          {createMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t('rollupRules.create', { count: keys.length })}
        </Button>
      </SheetFooter>
    </form>
  )
}

function RollupRuleView({
  rule,
  onDone,
}: {
  rule: RollupRuleDTO
  onDone: () => void
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SheetBody className="space-y-5">
        <Fact label={t('rollupRules.property')}>
          <span className="font-medium">
            {resolvePropertyLabel(rule.propertyKey, undefined, locale)}
          </span>
        </Fact>
        <Fact label={t('rollupRules.propertyKey')}>
          <span className="font-mono text-xs text-muted-foreground">
            {rule.propertyKey}
          </span>
        </Fact>
        <Fact label={t('rollupRules.aggregation')}>
          {t(`rollupRules.aggregations.${rule.aggregation}`)}
        </Fact>
        <Fact label={t('common.owner')}>
          <OwnerCell
            system={rule.system}
            ownerUserId={rule.ownerUserId}
            ownerName={rule.createdByName}
          />
        </Fact>
        <Fact label={t('objects.fields.created')}>
          {formatTimestamp(rule.createdAt)}
        </Fact>

        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {rule.system
            ? t('rollupRules.systemReadOnly')
            : t('rollupRules.replaceToChange')}
        </p>
      </SheetBody>

      <SheetFooter className="border-t px-6 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onDone}
        >
          {t('common.close')}
        </Button>
      </SheetFooter>
    </div>
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
      <div className="text-sm">{children}</div>
    </div>
  )
}
