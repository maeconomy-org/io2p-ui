'use client'

import { useId, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, TriangleAlert, X } from 'lucide-react'

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
  isCertainlyNonNumericKey,
  multiplierCollides,
  normalizeRollupPropertyKey,
  rollupRuleCreateBody,
  ROLLUP_AGGREGATIONS,
  type RollupAggregation,
} from '../lib/rollup-rule'
import { anchor } from '@/constants'

export type RollupRuleSheetMode = 'create' | 'edit' | 'view'

interface RollupRuleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RollupRuleSheetMode
  /** The subject for `view` and `edit`. */
  rule?: RollupRuleDTO | null
  /** Queue a recompute of the viewed rule. Omitted where the viewer may not run one. */
  onRecompute?: (rule: RollupRuleDTO) => void
}

export function RollupRuleSheet({
  open,
  onOpenChange,
  mode,
  rule = null,
  onRecompute,
}: RollupRuleSheetProps) {
  const t = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>
            {mode === 'create'
              ? t('rollupRules.createTitle')
              : (rule?.propertyKey ?? t('rollupRules.title'))}
          </SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('rollupRules.createDescription')
              : mode === 'edit'
                ? t('rollupRules.editDescription')
                : t('rollupRules.keyImmutable')}
          </SheetDescription>
        </SheetHeader>

        {/* Mounts fresh per open, so the fields seed at mount rather than being re-synced by an
            effect — the same guard the constant sheet needs. */}
        {open &&
          (mode === 'edit' && rule ? (
            <RollupRuleEdit rule={rule} onDone={() => onOpenChange(false)} />
          ) : mode === 'view' && rule ? (
            <RollupRuleView
              rule={rule}
              onDone={() => onOpenChange(false)}
              onRecompute={onRecompute}
            />
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
  const [multiplyBy, setMultiplyBy] = useState('')

  const takenKeys = useMemo(
    () => new Set((ownRules?.data ?? []).map((r) => r.propertyKey)),
    [ownRules]
  )

  const normalizedDraft = normalizeRollupPropertyKey(draft)
  // Only when the two differ: echoing an unchanged key would be noise on every keystroke.
  const showNormalized = normalizedDraft !== '' && normalizedDraft !== draft
  const draftExists = normalizedDraft !== '' && takenKeys.has(normalizedDraft)
  const draftNonNumeric =
    normalizedDraft !== '' && isCertainlyNonNumericKey(normalizedDraft)
  const draftQueued = keys.includes(normalizedDraft)
  const canAdd = normalizedDraft !== '' && !draftExists && !draftQueued

  /**
   * One multiplier for every queued key — "sum weight, volume and cost, each scaled by quantity"
   * is the intent, and per-key would need a chip editor for a field most rules never set.
   *
   * Normalized like the rolled-up key, and for the same reason: a rule matches the node's index on
   * an exact key, so a Dutch-typed "Aantal" has to resolve to what the property field wrote.
   */
  const normalizedMultiplier = normalizeRollupPropertyKey(multiplyBy)
  const showMultiplierNormalized =
    normalizedMultiplier !== '' && normalizedMultiplier !== multiplyBy
  // The node 422s a rule that multiplies by its own key. With ONE multiplier over N queued keys
  // that rejects exactly one create, and the toast cannot say which chip — so block the submit
  // instead and name the collision.
  const collides = multiplierCollides(multiplyBy, keys)
  // Inverted emphasis from the rolled-up key's warning: a text-valued rollup key produces an empty
  // total, but a text-valued MULTIPLIER drops each contributor out of a total that still looks
  // plausible.
  const multiplierNonNumeric =
    normalizedMultiplier !== '' &&
    isCertainlyNonNumericKey(normalizedMultiplier)

  const canSave = keys.length > 0 && !collides && !createMutation.isPending

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
          body: rollupRuleCreateBody(key, aggregation, multiplyBy),
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
  const multiplierHintId = `${fieldId}-multiply-by-hint`

  return (
    <form
      onSubmit={submit}
      className="-mx-1 flex min-h-0 flex-1 flex-col overflow-hidden px-1"
    >
      <SheetBody className="space-y-5">
        <div className="space-y-2" {...anchor('sheetRollupKeys')}>
          <Label htmlFor={fieldId}>{t('rollupRules.propertyKeys')}</Label>
          <div className="flex items-start gap-2">
            <PropertyNameCombobox
              id={fieldId}
              value={draft}
              onChange={(key) => setDraft(key)}
              // Enter queues the key, so several can be typed in a row without reaching for the
              // mouse. `addKey` is a no-op unless `canAdd`, so a duplicate or empty key just sits.
              onEnter={addKey}
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
              <p
                className="text-xs text-destructive"
                data-testid="rollup-rule-duplicate-key"
              >
                {t('rollupRules.duplicateKey')}
              </p>
            ) : draftQueued ? (
              <p
                className="text-xs text-destructive"
                data-testid="rollup-rule-already-queued"
              >
                {t('rollupRules.alreadyQueued')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.propertyKeyHint')}
              </p>
            )}
            {/* A warning, never a block: the node accepts the rule, and a key
                the dictionary calls text can still hold numbers in practice. */}
            {draftNonNumeric && (
              <p
                className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
                data-testid="rollup-rule-non-numeric-warning"
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('rollupRules.nonNumericKey')}</span>
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
          <Label htmlFor={`${fieldId}-multiply-by`}>
            {t('rollupRules.multiplyBy')}
          </Label>
          <PropertyNameCombobox
            id={`${fieldId}-multiply-by`}
            value={multiplyBy}
            onChange={(key) => setMultiplyBy(key)}
            placeholder={t('rollupRules.placeholders.multiplyBy')}
            aria-invalid={collides}
            aria-describedby={multiplierHintId}
            data-testid="rollup-rule-multiply-by"
          />
          <div id={multiplierHintId} className="space-y-1">
            {showMultiplierNormalized && (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.normalizedAs', { key: normalizedMultiplier })}
              </p>
            )}
            {collides ? (
              <p
                className="text-xs text-destructive"
                data-testid="rollup-rule-multiply-by-collision"
              >
                {t('rollupRules.multiplyBySelf')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.multiplyByHint')}
              </p>
            )}
            {multiplierNonNumeric && !collides && (
              <p
                className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
                data-testid="rollup-rule-multiply-by-non-numeric"
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('rollupRules.multiplyByNonNumeric')}</span>
              </p>
            )}
          </div>
        </div>

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
          {...anchor('sheetSubmit')}
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

/**
 * Edit the ONE field a PATCH may change.
 *
 * `propertyKey` and `aggregation` are the rule's identity — every stored total pins the ruleId, so
 * the node 422s a PATCH naming either and changing a key is still delete-then-create. They are
 * shown here as facts, not inputs, so the sheet states what cannot move rather than leaving the
 * reader to discover it by finding no field.
 */
function RollupRuleEdit({
  rule,
  onDone,
}: {
  rule: RollupRuleDTO
  onDone: () => void
}) {
  const t = useTranslations()
  const fieldId = useId()
  const locale = useLocale() as PropertyDictionaryLocale

  const { useUpdate } = useRollupRules()
  const updateMutation = useUpdate()

  const [multiplyBy, setMultiplyBy] = useState(
    () => rule.multiplyBy?.propertyKey ?? ''
  )

  const normalized = normalizeRollupPropertyKey(multiplyBy)
  const showNormalized = normalized !== '' && normalized !== multiplyBy
  // The node 422s a rule multiplying by its own key. One field, one key, so this is a plain
  // comparison rather than the create form's queue check.
  const collides = normalized !== '' && normalized === rule.propertyKey
  const nonNumeric = normalized !== '' && isCertainlyNonNumericKey(normalized)

  // BOTH sides normalized. Comparing the resolved draft against the RAW stored key opened
  // the sheet with Save already enabled on any rule whose key is a dictionary alias, and one
  // click then re-pointed the multiplier the user never touched.
  const current = normalizeRollupPropertyKey(rule.multiplyBy?.propertyKey ?? '')
  const changed = normalized !== current
  const canSave = changed && !collides && !updateMutation.isPending

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    try {
      // `null` CLEARS it. Sending `undefined` would mean "no change" and silently keep the
      // multiplier the user just emptied.
      await updateMutation.mutateAsync({
        id: rule.id,
        body: {
          // `whenMissing` rides along. The node `$set`s the whole sub-document, so omitting
          // it silently resets a `skip` rule to the `one` default — every total moves, and
          // the user was never shown the flag to know they had changed it.
          multiplyBy: normalized
            ? {
                propertyKey: normalized,
                ...(rule.multiplyBy?.whenMissing === undefined
                  ? {}
                  : { whenMissing: rule.multiplyBy.whenMissing }),
              }
            : null,
        },
      })
      toast.success(t('rollupRules.updated'))
      onDone()
    } catch (error) {
      logger.error('Update rollup rule failed', { err: error, id: rule.id })
      const { key, values } = rollupRuleErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  const hintId = `${fieldId}-multiply-by-hint`

  return (
    <form
      onSubmit={submit}
      className="-mx-1 flex min-h-0 flex-1 flex-col overflow-hidden px-1"
    >
      <SheetBody className="space-y-5">
        <Fact label={t('rollupRules.property')}>
          <span className="font-medium">
            {resolvePropertyLabel(rule.propertyKey, undefined, locale)}
          </span>
          <span className="ml-1.5 font-mono text-xs text-muted-foreground">
            {rule.propertyKey}
          </span>
        </Fact>
        <Fact label={t('rollupRules.aggregation')}>
          {t(`rollupRules.aggregations.${rule.aggregation}`)}
        </Fact>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-multiply-by`}>
            {t('rollupRules.multiplyBy')}
          </Label>
          <PropertyNameCombobox
            id={`${fieldId}-multiply-by`}
            value={multiplyBy}
            onChange={(key) => setMultiplyBy(key)}
            placeholder={t('rollupRules.placeholders.multiplyBy')}
            aria-invalid={collides}
            aria-describedby={hintId}
            data-testid="rollup-rule-edit-multiply-by"
          />
          <div id={hintId} className="space-y-1">
            {showNormalized && (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.normalizedAs', { key: normalized })}
              </p>
            )}
            {collides ? (
              <p
                className="text-xs text-destructive"
                data-testid="rollup-rule-edit-collision"
              >
                {t('rollupRules.multiplyBySelf')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('rollupRules.multiplyByHint')}
              </p>
            )}
            {nonNumeric && !collides && (
              <p
                className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
                data-testid="rollup-rule-edit-non-numeric"
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('rollupRules.multiplyByNonNumeric')}</span>
              </p>
            )}
          </div>
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('rollupRules.replaceToChange')}
        </p>
      </SheetBody>

      <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onDone}
          disabled={updateMutation.isPending}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          className="w-full"
          disabled={!canSave}
          data-testid="rollup-rule-edit-submit"
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t('common.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}

function RollupRuleView({
  rule,
  onDone,
  onRecompute,
}: {
  rule: RollupRuleDTO
  onDone: () => void
  onRecompute?: (rule: RollupRuleDTO) => void
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
        {rule.multiplyBy && (
          <Fact label={t('rollupRules.multiplyBy')}>
            <span className="font-medium">
              {resolvePropertyLabel(
                rule.multiplyBy.propertyKey,
                undefined,
                locale
              )}
            </span>
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              {rule.multiplyBy.propertyKey}
            </span>
          </Fact>
        )}
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

      <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onDone}
        >
          {t('common.close')}
        </Button>
        {/* A system rule fans out across every object on the node, and a deleted one computes
            nothing — the node refuses both, so neither is offered. */}
        {onRecompute && !rule.system && !rule.deleted && (
          <Button
            type="button"
            className="flex-1"
            data-testid="rollup-rule-recompute"
            onClick={() => onRecompute(rule)}
          >
            {t('rollupRules.recompute')}
          </Button>
        )}
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
