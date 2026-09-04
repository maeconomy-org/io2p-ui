'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react'
import type { CalcArgInput, CalcInput, ConstantDTO } from 'io2p-client'

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { OwnerHint } from '@/components/entity-list'
import { useConstants, useFormulas } from '@/hooks/api/leaves'
import { evaluateExpression } from '@/lib/formula-expression'
import { SEARCH_SIZE } from '@/constants'

/**
 * A sibling value a formula variable can bind to. `key` = existing id ?? client ref.
 *
 * `num` is OPTIONAL because a bindable value is not always filled in yet — a template preset arrives
 * blank but already bound. Such a sibling can be selected and displayed; it just can't contribute to
 * the live preview until it holds a number.
 */
export interface FormulaSibling {
  key: string
  /**
   * The PROPERTY's stable key, as distinct from `key` above — which is the value's id.
   *
   * Carried only so the option can be addressed by something that does not move: the testid used to
   * be minted from `label`, and `label` is `resolvePropertyLabel(...)`, so `width` rendered as
   * `formula-sibling-Width` in English and `formula-sibling-Breedte` in Dutch. Three spec files were
   * silently coupled to the account's language that way.
   */
  propertyKey: string
  label: string
  num?: number
}

// The formula chooser — sits inline in the value row (replaces the text input in formula mode).
export function FormulaSelect({
  formulaId,
  onSelect,
  className,
}: {
  formulaId?: string
  onSelect: (formulaId: string) => void
  className?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data, isFetching } = useFormulas().useList(
    { page: 1, size: SEARCH_SIZE, q: query.trim() || undefined },
    { enabled: open, keepPreviousData: true }
  )
  const formulas = data?.data ?? []

  // The label cannot come from the list above: `q` narrows it, so the selected formula leaves the
  // page as soon as the user searches for anything else.
  const { data: selected } = useFormulas().useGet(formulaId)

  return (
    // `modal`: this renders inside the entity sheet, a Radix Dialog that sets
    // `pointer-events: none` on the body. A portalled popover inherits it, and its list stops
    // answering a wheel while still responding to the arrow keys.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="formula-select"
          className={cn(
            'h-8 w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {selected?.name ?? t('objects.formulaEditor.selectFormula')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* The node filters server-side, so let Command show whatever came back. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('objects.formulaEditor.searchFormulas')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && formulas.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {t('objects.formulaEditor.noFormulas')}
              </CommandEmpty>
            )}
            <CommandGroup>
              {formulas.map((f) => (
                <CommandItem
                  key={f.id}
                  value={f.id}
                  data-testid={`formula-option-${f.name}`}
                  onSelect={() => {
                    onSelect(f.id)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <OwnerHint
                    system={f.system}
                    ownerUserId={f.ownerUserId}
                    ownerName={f.ownerName}
                  />
                  <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                    {f.expression}
                    {f.unit ? ` → ${f.unit}` : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * One control, two kinds of binding.
 *
 * A calc arg binds a variable to a sibling value (`ref`) XOR a constant (`constantId`) — never both,
 * never neither. So the picker prefixes each option with its kind instead of putting a mode switch
 * beside it: choosing is one gesture, and the exclusivity is structural rather than something the UI
 * has to remember to enforce.
 *
 * Both sides are ids, which contain no `:` — but splitting on the FIRST separator costs nothing and
 * keeps this correct if either ever carries one.
 */
export function choiceOf(arg?: CalcArgInput): string {
  if (arg?.constantId) return `constant:${arg.constantId}`
  if (arg?.ref) return `sibling:${arg.ref}`
  return ''
}

export function argFromChoice(
  variable: string,
  choice: string
): CalcArgInput | null {
  if (!choice) return null
  const separator = choice.indexOf(':')
  if (separator === -1) return null

  const kind = choice.slice(0, separator)
  const value = choice.slice(separator + 1)
  if (!value) return null

  return kind === 'constant'
    ? { var: variable, constantId: value }
    : { var: variable, ref: value }
}

// Variable binding + live preview for the chosen formula. Rendered below the value row.
export function FormulaBindings({
  calc,
  siblings,
  onChange,
}: {
  calc: CalcInput
  siblings: FormulaSibling[]
  onChange: (calc: CalcInput) => void
}) {
  const t = useTranslations()
  const { data: formula } = useFormulas().useGet(calc.formulaId)

  // Every constant this recipe already binds, fetched BY ID rather than looked up in the picker's
  // search page — a bound constant has to keep its label and its preview number whatever the user
  // last typed into the search box, and it may not be on that page at all.
  const boundIds = useMemo(
    () =>
      Array.from(
        new Set(
          calc.args.map((a) => a.constantId).filter((id): id is string => !!id)
        )
      ),
    [calc.args]
  )
  const boundConstants = useConstants().useByIds(boundIds)

  const bindingFor = (variable: string) =>
    choiceOf(calc.args.find((a) => a.var === variable))

  const bindVariable = (variable: string, choice: string) => {
    const others = calc.args.filter((a) => a.var !== variable)
    const arg = argFromChoice(variable, choice)
    onChange({ ...calc, args: arg ? [...others, arg] : others })
  }

  const preview = useMemo(() => {
    if (!formula) return null
    const scope: Record<string, number> = {}
    for (const v of formula.variables) {
      const arg = calc.args.find((a) => a.var === v)
      // A constant resolves to its CURRENT version here. The server pins the version at bind time,
      // so once saved this value is fixed — the preview shows what binding now would produce.
      const num = arg?.constantId
        ? boundConstants.get(arg.constantId)?.versions.at(-1)?.num
        : siblings.find((s) => s.key === arg?.ref)?.num
      // Unbound, or bound to a value the user hasn't filled in yet — either way there is nothing
      // honest to preview.
      if (num === undefined || !Number.isFinite(num)) return null
      scope[v] = num
    }
    try {
      // Same parser, options and rounding the server uses, so the preview is the number that will
      // be stored — not an approximation of it.
      return {
        result: evaluateExpression(formula.expression, scope),
        error: null,
      }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [formula, calc.args, siblings, boundConstants])

  if (!formula) return null

  return (
    <div
      data-testid="formula-bindings"
      className="space-y-2 rounded-md border bg-muted/30 p-3"
    >
      {/* Free: `formula` is already fetched for the variable list and the preview. The node lets a
          superseded formula bind — the status is a signal, never a gate — so this warns and offers
          the correction rather than swapping or blocking anything. */}
      {formula.supersededBy && (
        <div
          data-testid="formula-superseded"
          className="flex flex-wrap items-center gap-1.5 text-xs text-destructive"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t('formulas.supersededWarning')}</span>
          <button
            type="button"
            className="underline underline-offset-2"
            data-testid="formula-use-correction"
            onClick={() =>
              onChange({ formulaId: formula.supersededBy!, args: [] })
            }
          >
            {t('formulas.useCorrection')}
          </button>
        </div>
      )}

      {formula.variables.length === 0 ? (
        <p
          data-testid="formula-no-variables"
          className="text-xs text-muted-foreground"
        >
          {t('objects.formulaEditor.noVariables')}
        </p>
      ) : (
        <>
          <Label className="text-xs text-muted-foreground">
            {t('objects.formulaEditor.bindVariables')}
          </Label>
          {formula.variables.map((variable) => (
            <div
              key={variable}
              data-testid={`formula-var-${variable}`}
              className="flex items-center gap-2"
            >
              <code className="w-16 shrink-0 text-sm font-medium">
                {variable}
              </code>
              <BindingPicker
                variable={variable}
                value={bindingFor(variable)}
                siblings={siblings}
                boundConstants={boundConstants}
                onChange={(choice) => bindVariable(variable, choice)}
              />
            </div>
          ))}
        </>
      )}

      {preview && (
        <div
          data-testid="formula-preview"
          data-error={preview.error !== null}
          className={cn(
            'flex items-center gap-1.5 text-sm',
            preview.error ? 'text-destructive' : 'text-emerald-600'
          )}
        >
          {preview.error ? (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>{preview.error}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t('objects.formulaEditor.result')}: {preview.result}
                {/* The DECLARED symbol, not what the value will be stored in: the node converts a
                    declared unit to its dimension's canonical form, so a formula declaring `J`
                    stores kWh. Shown anyway because it is what this formula claims to produce. */}
                {formula?.unit ? ` ${formula.unit}` : ''}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One variable's binding: a sibling value XOR a constant.
 *
 * The two halves search differently on purpose. Siblings are this entity's own values, already in
 * memory and never more than a handful, so they filter locally. Constants come from the node and
 * there is no ceiling on how many exist, so the search term goes to `q` — which is why the trigger's
 * label comes from `boundConstants` (fetched by id) rather than from the page on screen.
 */
/**
 * Which side of the picker to show. `all` is the default because most bindings are a value on this
 * entity and the rest are a constant — the filter exists for the case where one side has enough
 * entries to push the other off screen.
 */
type BindingScope = 'all' | 'siblings' | 'constants'

const BINDING_SCOPES: BindingScope[] = ['all', 'siblings', 'constants']

function BindingPicker({
  variable,
  value,
  siblings,
  boundConstants,
  onChange,
}: {
  variable: string
  value: string
  siblings: FormulaSibling[]
  boundConstants: ReadonlyMap<string, ConstantDTO>
  onChange: (choice: string) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<BindingScope>('all')

  const needle = query.trim()
  // Not fetched at all while the user is looking at values only — the group is hidden, so a page of
  // constants would be a request for something nothing renders.
  const { data: constantsPage, isFetching } = useConstants().useList(
    { page: 1, size: SEARCH_SIZE, q: needle || undefined },
    { enabled: open && scope !== 'siblings', keepPreviousData: true }
  )
  const constants = scope === 'siblings' ? [] : (constantsPage?.data ?? [])
  const shownSiblings =
    scope === 'constants'
      ? []
      : siblings.filter((s) =>
          s.label.toLowerCase().includes(needle.toLowerCase())
        )

  const [kind, ...rest] = value.split(':')
  const boundId = rest.join(':')
  const label = value
    ? kind === 'constant'
      ? boundConstants.get(boundId)?.name
      : siblings.find((s) => s.key === boundId)?.label
    : undefined

  const choose = (choice: string) => {
    onChange(choice)
    setOpen(false)
    setQuery('')
  }

  return (
    // `modal`: this renders inside the entity sheet, a Radix Dialog that sets
    // `pointer-events: none` on the body. A portalled popover inherits it, and its list stops
    // answering a wheel while still responding to the arrow keys.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={`formula-bind-${variable}`}
          className={cn(
            'h-8 w-full justify-between font-normal',
            !label && 'text-muted-foreground'
          )}
        >
          <span className="truncate">
            {label ?? t('objects.formulaEditor.selectValue')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('objects.formulaEditor.searchValues')}
            value={query}
            onValueChange={setQuery}
          />

          {/* A radiogroup, not three buttons: the options are mutually exclusive and a screen
              reader should hear which one is on. */}
          <div
            role="radiogroup"
            aria-label={t('objects.formulaEditor.filterBindings')}
            className="flex gap-1 border-b px-2 py-1.5"
          >
            {BINDING_SCOPES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={scope === option}
                data-testid={`binding-scope-${option}`}
                onClick={() => setScope(option)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  scope === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {t(`objects.formulaEditor.scope.${option}`)}
              </button>
            ))}
          </div>

          <CommandList>
            {/* Only when there is nothing at all to show. Gating the spinner on the CONSTANTS
                alone hid the sibling group on every first open — they are already in memory, and
                a failed constants fetch left "nothing to bind" on screen beside them. */}
            {isFetching && !shownSiblings.length && !constants.length ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {/* Naming the filter, not the data: "no numeric values" beside a Constants-only
                    list describes something the user is not looking at. */}
                {scope === 'constants'
                  ? t('objects.formulaEditor.noConstants')
                  : t('objects.formulaEditor.noNumericValues')}
              </CommandEmpty>
            )}

            {shownSiblings.length > 0 && (
              <CommandGroup heading={t('objects.formulaEditor.siblingValues')}>
                {shownSiblings.map((s) => (
                  <CommandItem
                    key={s.key}
                    value={`sibling:${s.key}`}
                    data-testid={`formula-sibling-${s.propertyKey}`}
                    onSelect={choose}
                  >
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {s.num !== undefined && (
                      <span className="ml-1 shrink-0 text-muted-foreground">
                        ({s.num})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Constants are shared, versioned numbers — a CO2 factor rather than something on
                this entity. The server pins the version at bind time, so the value shown is what
                this binding will freeze. */}
            {constants.length > 0 && (
              <CommandGroup heading={t('objects.formulaEditor.constants')}>
                {constants.map((c) => {
                  const current = c.versions.at(-1)
                  return (
                    <CommandItem
                      key={c.id}
                      value={`constant:${c.id}`}
                      data-testid={`formula-constant-${c.name}`}
                      onSelect={choose}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <OwnerHint
                        system={c.system}
                        ownerUserId={c.ownerUserId}
                        ownerName={c.ownerName}
                      />
                      {current?.data && (
                        <span className="ml-1 shrink-0 text-muted-foreground">
                          ({current.data})
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * A bound recipe, read-only: which formula, and what each variable is bound to.
 *
 * This is what a TEMPLATE formula looks like. A template stores its recipe INERT — `source:'derived'`
 * plus `calc`, with no `num` and no `provenance`, because it computes only when the template is
 * applied to a real entity (E-2). So there is no trace to render and no result to show; without this
 * the value reads as an empty string, which looks like nothing was ever configured.
 */
export function FormulaSummary({
  calc,
  labelForValue,
}: {
  calc: CalcInput
  labelForValue?: (ref: string) => string | undefined
}) {
  const t = useTranslations()
  const { data: formula } = useFormulas().useGet(calc.formulaId)

  // A calc carries the constant's id, not its name, so the name has to be fetched — otherwise this
  // read-only summary would print a uuid where the author wrote `co2_factor`.
  const boundIds = useMemo(
    () =>
      Array.from(
        new Set(
          calc.args.map((a) => a.constantId).filter((id): id is string => !!id)
        )
      ),
    [calc.args]
  )
  const boundConstants = useConstants().useByIds(boundIds)

  const bindingLabel = (variable: string): string => {
    const arg = calc.args.find((a) => a.var === variable)
    if (arg?.constantId)
      return boundConstants.get(arg.constantId)?.name ?? t('common.unknown')
    if (arg?.ref) return labelForValue?.(arg.ref) ?? t('common.unknown')
    return t('objects.formulaEditor.unbound')
  }

  // Variables come from the formula record, so until it loads there is nothing truthful to list —
  // showing the recipe's args instead would omit any variable the user has not bound yet.
  const variables = formula?.variables ?? []

  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">
          {formula?.name ?? t('objects.propertyEditor.derived')}
        </span>
        {formula?.expression && (
          <code className="font-mono text-xs text-muted-foreground">
            {formula.expression}
          </code>
        )}
      </div>
      {variables.length > 0 && (
        <dl className="space-y-0.5">
          {variables.map((variable) => (
            <div key={variable} className="flex items-baseline gap-2 text-xs">
              <dt className="w-10 shrink-0 font-mono font-medium">
                {variable}
              </dt>
              <dd className="min-w-0 truncate text-muted-foreground">
                {bindingLabel(variable)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t('templates.formulaInert')}
      </p>
    </div>
  )
}
