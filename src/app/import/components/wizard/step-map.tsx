'use client'

import { useTranslations } from 'next-intl'

import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { anchor } from '@/constants'
import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'
import type { ColumnTarget } from '@/app/import/lib/build-items'
import {
  ATTACH_EVERY_LEVEL,
  columnLabel,
  countItems,
  deriveKey,
} from '@/app/import/lib/build-items'
import type {
  ImportWizard,
  WizardColumn,
} from '@/app/import/hooks/use-import-wizard'

/**
 * One screen, one decision per column. Every column is a row carrying its own header, its real
 * sample values and its target, so the question and the evidence sit on the same line.
 *
 * A column is never silently dropped: anything no field claims falls through to a property.
 */

// The `value` is what the mapping stores AND what names the label — module scope cannot call `t`,
// and a parallel label array would be a second place to keep in step.
const TARGETS = [
  'skip',
  'name',
  'description',
  'property',
  'address',
  'address.street',
  'address.houseNumber',
  'address.postalCode',
  'address.city',
  'address.state',
  'address.country',
  'fileUrl',
  'key',
  'parent',
] as const

/** The delimiter IS the label for three of these, so only the mode needs translating. */
const SPLITS = [
  { value: 'none', labelKey: 'import.map.split.one' },
  { value: ';', labelKey: 'import.map.split.on', char: ';' },
  { value: ',', labelKey: 'import.map.split.on', char: ',' },
  { value: '|', labelKey: 'import.map.split.on', char: '|' },
]

/**
 * NOT just `targets.<value>`: next-intl reserves `.` for nesting, so `targets['address.street']`
 * is an invalid KEY and it refuses the whole message file at provider construction — the APP fails
 * to render, not just this select. Address parts live under their own `addressPart` group, which
 * they cannot share with `address`: that is already a leaf, and a key cannot be both.
 */
function targetLabelKey(value: string): string {
  return value.startsWith('address.')
    ? `import.map.targets.addressPart.${value.slice('address.'.length)}`
    : `import.map.targets.${value}`
}

function targetValue(target: ColumnTarget | undefined): string {
  if (!target) return 'skip'
  if (target.kind === 'addressPart') return `address.${target.part}`
  return target.kind
}

function toTarget(value: string, column: WizardColumn): ColumnTarget | null {
  if (value === 'skip') return null
  if (value.startsWith('address.')) {
    return {
      kind: 'addressPart',
      part: value.slice('address.'.length) as 'street',
    }
  }
  if (value === 'property') {
    const label = columnLabel(column.header, column.index)
    return {
      kind: 'property',
      key: deriveKey(column.header, column.index),
      label,
      split: null,
    }
  }
  return { kind: value as 'name' }
}

/**
 * Why this column's target will do nothing, or `null`.
 *
 * `key` and `parent` can be mapped and then silently ignored: `applyCell` returns early for
 * identity columns, so the value is not written as a property either — it disappears.
 *
 *  • With LEVELS on, the hierarchy comes from the level columns and both are discarded outright.
 *  • With no levels and no `parent` column, a `key` names the row's tempId and nothing ever
 *    references it, so it changes nothing about what is created.
 *
 * Said on the row rather than hiding the option: hiding it would make the id/parent shape
 * undiscoverable for the sheets that DO carry one.
 */
function inertBecause(
  target: ColumnTarget | undefined,
  wizard: ImportWizard
): 'levelsWin' | 'noParent' | null {
  if (target?.kind !== 'key' && target?.kind !== 'parent') return null
  if (wizard.levels.length > 0) return 'levelsWin'
  if (target.kind !== 'key') return null
  const hasParent = Object.values(wizard.mapping.columns).some(
    (t) => t.kind === 'parent'
  )
  return hasParent ? null : 'noParent'
}

function ColumnRow({
  column,
  wizard,
}: {
  column: WizardColumn
  wizard: ImportWizard
}) {
  const t = useTranslations()
  const target = wizard.mapping.columns[column.index]
  const isLevel = wizard.levels.includes(column.index)
  const levelIndex = wizard.levels.indexOf(column.index)
  const inert = inertBecause(target, wizard)

  return (
    <div
      data-testid={`map-column-${column.index}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 py-3"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {column.header ||
              t('import.map.unnamedColumn', { index: column.index + 1 })}
          </span>
          {isLevel && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Layers className="h-3 w-3" />
              {t('import.map.levelBadge', { level: levelIndex + 1 })}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {column.samples.join(' · ') || t('import.map.noValues')}
        </p>
        {inert && (
          <p
            data-testid={`map-inert-${column.index}`}
            data-reason={inert}
            className="text-xs text-amber-600 dark:text-amber-400"
          >
            {t(`import.map.inert.${inert}`)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {target?.kind === 'property' && (
          <Select
            value={target.split ?? 'none'}
            onValueChange={(value) =>
              wizard.setColumn(column.index, {
                ...target,
                split: value === 'none' ? null : value,
              })
            }
          >
            <SelectTrigger
              data-testid={`map-split-${column.index}`}
              className="h-8 w-[9rem] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPLITS.map((split) => (
                <SelectItem
                  key={split.value}
                  value={split.value}
                  data-testid={`map-split-option-${split.value}`}
                >
                  {t(split.labelKey, { char: split.char ?? '' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {wizard.levels.length > 0 && !isLevel && target && (
          <Select
            value={String(wizard.attachTo[column.index] ?? 'deepest')}
            onValueChange={(value) =>
              wizard.setAttachTo((current) => {
                const next = { ...current }
                if (value === 'deepest') delete next[column.index]
                else next[column.index] = Number(value)
                return next
              })
            }
          >
            <SelectTrigger
              data-testid={`map-attach-${column.index}`}
              className="h-8 w-[10rem] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="deepest"
                data-testid="map-attach-option-deepest"
              >
                {t('import.map.attachDeepest')}
              </SelectItem>
              <SelectItem
                value={String(ATTACH_EVERY_LEVEL)}
                data-testid="map-attach-option-every"
              >
                {t('import.map.attachEvery')}
              </SelectItem>
              {wizard.levels.map((levelColumn, index) => (
                <SelectItem
                  key={levelColumn}
                  value={String(index)}
                  data-testid={`map-attach-option-${index}`}
                >
                  {t('import.map.attachTo', {
                    level:
                      wizard.headers[levelColumn] ||
                      t('import.map.levelBadge', { level: index + 1 }),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          size="sm"
          variant={isLevel ? 'secondary' : 'ghost'}
          data-testid={`map-level-${column.index}`}
          data-level={isLevel}
          className="h-8 px-2 text-xs"
          onClick={() => wizard.toggleLevel(column.index)}
        >
          <Layers className="mr-1 h-3 w-3" />
          {isLevel ? t('import.map.isLevel') : t('import.map.makeLevel')}
        </Button>

        <Select
          value={targetValue(target)}
          onValueChange={(value) =>
            wizard.setColumn(column.index, toTarget(value, column))
          }
        >
          <SelectTrigger
            data-testid={`map-target-${column.index}`}
            className="h-8 w-[13rem] text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((option) => (
              <SelectItem
                key={option}
                value={option}
                data-testid={`map-target-option-${option}`}
              >
                {t(targetLabelKey(option))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function StepMap({ wizard }: { wizard: ImportWizard }) {
  const t = useTranslations()
  /**
   * ASKED FOR, never volunteered — and NOT a tuning problem, so do not make it automatic again.
   *
   * Volunteered, it fired on TEN of 16 sheets of a real municipal asset register and was wrong
   * every time: 200 grass areas → 3 objects, one paving sheet → 466 objects from 200 rows. The
   * test asks "do these columns partition the rows?", which data can answer; the question is "is
   * this value a CONTAINER for that one?", which it cannot. `Gebouw › Verdieping` and
   * `BEHEERGROEP › AANLEGJAAR` are identical in the numbers. Three discriminators were tried.
   *
   * Accepting a wrong one is destructive: every non-level column folds onto the deepest level, so
   * 200 rows collapsing to 3 silently merges 197 rows' data away.
   */
  const [asked, setAsked] = useState(false)

  const unusedSuggestion = wizard.suggestedLevels.filter(
    (column) => !wizard.levels.includes(column)
  )
  const canAsk = wizard.levels.length === 0
  const showProposal = asked && canAsk && unusedSuggestion.length > 0
  const askedAndFoundNothing = asked && canAsk && unusedSuggestion.length === 0

  /** A column with a blank header still has to be nameable in a sentence. */
  const columnName = (index: number) =>
    wizard.headers[index] || t('import.map.unnamedColumn', { index: index + 1 })

  /**
   * What accepting would actually produce — the one part of this a person can judge.
   *
   * Naming columns tells you nothing: the numbers behind a real hierarchy and a pair of unrelated
   * categories are the same. "200 rows would become 3 objects" is instantly, obviously wrong.
   */
  const suggestedCount = useMemo(
    () =>
      showProposal
        ? countItems(wizard.dataRows, {
            ...wizard.mapping,
            levels: unusedSuggestion,
          })
        : 0,
    [showProposal, wizard.dataRows, wizard.mapping, unusedSuggestion]
  )

  /**
   * The walkthrough works the two controls a person cannot be shown otherwise.
   *
   * The hierarchy box and the applied-hierarchy bar are mutually exclusive —
   * `canAsk` is `levels.length === 0` and the bar needs the opposite — and so is
   * the per-column "attaches to" select. A tour that only pointed at things
   * could never show the second half of this screen at all.
   *
   * Each of the four is exactly what one visible button does, so the walkthrough
   * cannot reach a state the user could not have reached themselves.
   */
  useTourAction(TOUR_ACTIONS.importSuggestLevels, () => setAsked(true))
  useTourAction(TOUR_ACTIONS.importHideSuggestion, () => setAsked(false))
  useTourAction(TOUR_ACTIONS.importApplyLevels, () =>
    wizard.setLevels(unusedSuggestion)
  )
  useTourAction(TOUR_ACTIONS.importClearLevels, () => wizard.setLevels([]))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">{t('import.map.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('import.map.subtitle')}
        </p>
      </div>

      {/* ASKED FOR, never a proposal that arrives on its own — see the note on `asked`. */}
      {canAsk && (
        <div
          className="flex items-start gap-3 rounded-md border bg-muted/30 p-3"
          {...anchor('importHierarchy')}
        >
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-2">
            {showProposal ? (
              <>
                <p className="text-sm">
                  {t('import.map.proposal')}{' '}
                  <span className="font-medium">
                    {unusedSuggestion.map((c) => columnName(c)).join(' › ')}
                  </span>
                </p>
                {/* The COUNT is the point: "200 rows would become 3 objects" is wrong at a
                    glance, where a list of column names is not. */}
                <p
                  data-testid="map-suggest-effect"
                  {...anchor('importHierarchyEffect')}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {t('import.map.suggestionEffect', {
                    rows: wizard.dataRows.length,
                    objects: suggestedCount,
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="map-suggest-accept"
                    onClick={() => wizard.setLevels(unusedSuggestion)}
                  >
                    {t('import.map.useHierarchy')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAsked(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">{t('import.map.levelsExplainer')}</p>
                {askedAndFoundNothing ? (
                  <p
                    data-testid="map-suggest-none"
                    className="text-xs text-muted-foreground"
                  >
                    {t('import.map.noneFound')}
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="map-suggest"
                    onClick={() => setAsked(true)}
                  >
                    {t('import.map.askForSuggestion')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {wizard.levels.length > 0 && (
        <div
          className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3"
          {...anchor('importLevelBar')}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {wizard.levels.map((c) => columnName(c)).join(' › ')}
            </p>
            <p
              data-testid="map-level-summary"
              className="text-xs text-muted-foreground tabular-nums"
            >
              {t('import.map.rowsBecomeObjects', {
                rows: wizard.dataRows.length,
                objects: wizard.items.length,
              })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="map-clear-levels"
            onClick={() => wizard.setLevels([])}
          >
            {t('import.map.clearHierarchy')}
          </Button>
        </div>
      )}

      <div
        className={cn('divide-y rounded-md border')}
        {...anchor('importColumns')}
      >
        {wizard.columns.map((column) => (
          <ColumnRow key={column.index} column={column} wizard={wizard} />
        ))}
      </div>
    </div>
  )
}
