'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ObjectPicker } from '@/components/entity-sheet/fields/object-picker'
import { PickerListError } from '@/components/list-error'
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useUnits } from '@/hooks/api/leaves'
import { useUserSearch } from '@/hooks/api/users'
import { cn } from '@/lib/utils'

import { DateRangeField } from './date-range-field'
import {
  kindOf,
  type PanelError,
  type PanelField,
  type PanelKind,
  panelQuery,
  type PanelValues,
  panelValuesOf,
} from './filter-panel-query'
import { parseSearchQuery, type SearchFilter } from './search-parser'
import { UnitInput } from './unit-input'
import { useSearchGrammar } from './use-search-grammar'

interface FilterPanelProps {
  id: string
  /** The search text now. It can change while the panel is open. */
  query: string
  /** False on a list that takes no numbers, dates or folder. */
  ranges: boolean
  /** The field to focus when the panel opens, for a pill or a suggestion that opened it. */
  focusField?: PanelField
  /** A property pill that opened the panel: Apply changes that filter instead of adding one. */
  editProperty?: SearchFilter
  onApply: (query: string) => void
  ref?: React.Ref<FilterPanelHandle>
}

export interface FilterPanelHandle {
  /**
   * The search with the values typed here but not applied: null when nothing was typed, 'invalid'
   * after the panel showed why it cannot apply them.
   */
  pendingQuery(): string | null | 'invalid'
}

const DELETED_DEFAULT = 'default'

/**
 * The "Add filter" form. It owns no filter state of its own: Apply writes tokens into the search
 * text, and the parser reads them as if typed.
 */
export function FilterPanel({
  id,
  query,
  ranges,
  focusField,
  editProperty,
  onApply,
  ref,
}: FilterPanelProps) {
  const t = useTranslations('filterPanel')
  const grammar = useSearchGrammar()
  const [values, setValues] = React.useState<PanelValues>(() => ({
    ...panelValuesOf(parseSearchQuery(query, grammar)),
    ...(editProperty && {
      propertyKey: editProperty.propertyKey ?? editProperty.value,
      propertyValue: editProperty.propertyValue ?? '',
    }),
  }))
  const [touched, setTouched] = React.useState<ReadonlySet<PanelKind>>(
    () => new Set()
  )
  const [propertyTouched, setPropertyTouched] = React.useState(false)
  const [errors, setErrors] = React.useState<
    Partial<Record<PanelField, PanelError>>
  >({})
  const formRef = React.useRef<HTMLFormElement>(null)
  const units = useUnits({ enabled: ranges })

  React.useEffect(() => {
    if (!focusField) return
    formRef.current
      ?.querySelector<HTMLElement>(
        `[data-field="${focusField}"], [data-field-group="${focusField}"] button`
      )
      ?.focus()
  }, [focusField])

  const set = (patch: Partial<PanelValues>) => {
    setValues((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const field of Object.keys(patch)) delete next[field as PanelField]
      return next
    })
    for (const field of Object.keys(patch) as PanelField[]) {
      const kind = kindOf(field)
      if (kind) setTouched((prev) => new Set(prev).add(kind))
      else setPropertyTouched(true)
    }
  }

  const check = (): string | 'invalid' => {
    const result = panelQuery(query, values, ranges, touched, grammar, {
      replaceProperty:
        editProperty && propertyTouched ? editProperty : undefined,
    })
    if ('errors' in result) {
      setErrors(result.errors)
      const first = Object.keys(result.errors)[0]
      formRef.current
        ?.querySelector<HTMLElement>(`[data-field="${first}"]`)
        ?.focus()
      return 'invalid'
    }
    return result.query
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = check()
    if (result !== 'invalid') onApply(result)
  }

  React.useImperativeHandle(ref, () => ({
    pendingQuery: () =>
      touched.size === 0 && !propertyTouched ? null : check(),
  }))

  const errorId = (name: PanelField) => `${id}-${name}-error`
  const errorOf = (...names: PanelField[]) => {
    const name = names.find((n) => errors[n])
    return (
      name && (
        <p id={errorId(name)} className="text-xs text-destructive">
          {t(`error.${errors[name]}`)}
        </p>
      )
    )
  }

  const field = (name: PanelField, label: string, input: React.ReactNode) => (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={`${id}-${name}`} className="text-xs">
        {label}
      </Label>
      {input}
      {errorOf(name)}
    </div>
  )

  const textInput = (
    name: PanelField,
    extra?: React.ComponentProps<typeof Input>
  ) => (
    <Input
      id={`${id}-${name}`}
      data-field={name}
      value={values[name] as string}
      onChange={(e) => set({ [name]: e.target.value })}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? errorId(name) : undefined}
      className="h-9"
      autoComplete="off"
      {...extra}
    />
  )

  const dateField = (kind: 'created' | 'updated') => {
    const fromName = `${kind}From` as const
    const toName = `${kind}To` as const
    const labelId = `${id}-${kind}-label`
    const invalid = Boolean(errors[fromName] || errors[toName])
    return (
      <div className="grid min-w-0 gap-1.5">
        <span id={labelId} className="text-xs font-medium">
          {t(kind)}
        </span>
        <DateRangeField
          id={`${id}-${kind}`}
          field={fromName}
          labelledBy={labelId}
          from={values[fromName]}
          to={values[toName]}
          invalid={invalid}
          describedBy={
            invalid ? errorId(errors[toName] ? toName : fromName) : undefined
          }
          onChange={({ from, to }) => set({ [fromName]: from, [toName]: to })}
        />
        {errorOf(fromName, toName)}
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={submit}
      aria-label={t('title')}
      data-testid="filter-panel"
      className="flex flex-col"
      noValidate
    >
      <div className="grid gap-4 p-4">
        {ranges && (
          <fieldset className="grid min-w-0 gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              {t('number')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
              {field(
                'numberKey',
                t('numberKey'),
                textInput('numberKey', {
                  placeholder: t('numberKeyPlaceholder'),
                })
              )}
              {field(
                'numberFrom',
                t('numberFrom'),
                textInput('numberFrom', { inputMode: 'decimal' })
              )}
              {field(
                'numberTo',
                t('numberTo'),
                textInput('numberTo', { inputMode: 'decimal' })
              )}
              {field(
                'numberUnit',
                t('numberUnit'),
                <UnitInput
                  id={`${id}-numberUnit`}
                  data-field="numberUnit"
                  value={values.numberUnit}
                  units={units.data ?? []}
                  onValueChange={(numberUnit) => set({ numberUnit })}
                  aria-invalid={errors.numberUnit ? true : undefined}
                  aria-describedby={
                    errors.numberUnit ? errorId('numberUnit') : undefined
                  }
                  className="h-9"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('numberHint')}</p>
          </fieldset>
        )}

        <fieldset className="grid min-w-0 gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">
            {t('property')}{' '}
            <span className="font-normal text-muted-foreground">
              {editProperty
                ? t('propertyChanges', {
                    name: editProperty.propertyKey ?? editProperty.value,
                  })
                : t('propertyAdds')}
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {field(
              'propertyKey',
              t('propertyKey'),
              textInput('propertyKey', {
                placeholder: t('propertyKeyPlaceholder'),
              })
            )}
            {field(
              'propertyValue',
              t('propertyValue'),
              textInput('propertyValue', {
                placeholder: t('propertyValuePlaceholder'),
              })
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('propertyHint')}</p>
        </fieldset>

        {ranges && (
          <fieldset className="grid min-w-0 gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              {t('dates')}{' '}
              <span className="font-normal text-muted-foreground">
                {t('yourTimeZone')}
              </span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {dateField('created')}
              {dateField('updated')}
            </div>
          </fieldset>
        )}

        <div
          className={cn(
            'grid gap-2',
            ranges ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          )}
        >
          <div className="grid min-w-0 content-start gap-1.5">
            <Label id={`${id}-createdBy-label`} className="text-xs">
              {t('createdBy')}
            </Label>
            <UserPicker
              labelledBy={`${id}-createdBy-label`}
              value={values.createdBy}
              onChange={(createdBy) => set({ createdBy })}
            />
          </div>
          <div className="grid min-w-0 content-start gap-1.5">
            <Label id={`${id}-deleted-label`} className="text-xs">
              {t('deleted')}
            </Label>
            <Select
              value={values.deleted || DELETED_DEFAULT}
              onValueChange={(v) =>
                set({
                  deleted: (v === DELETED_DEFAULT
                    ? ''
                    : v) as PanelValues['deleted'],
                })
              }
            >
              <SelectTrigger
                id={`${id}-deleted`}
                data-field="deleted"
                aria-labelledby={`${id}-deleted-label`}
                className="h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DELETED_DEFAULT}>
                  {t('deletedDefault')}
                </SelectItem>
                <SelectItem value="all">{t('deletedAll')}</SelectItem>
                <SelectItem value="true">{t('deletedOnly')}</SelectItem>
                <SelectItem value="false">{t('deletedNone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {ranges && (
            <div
              className="grid min-w-0 content-start gap-1.5"
              data-field-group="folder"
            >
              <span id={`${id}-folder-label`} className="text-xs font-medium">
                {t('folder')}
              </span>
              <div className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ObjectPicker
                    value={values.folder?.id ?? ''}
                    displayName={values.folder?.name || undefined}
                    onSelect={(folderId, name) =>
                      set({ folder: { id: folderId, name } })
                    }
                    placeholder={t('folderPlaceholder')}
                    testId="filter-panel-folder"
                    labelledBy={`${id}-folder-label`}
                    className="h-9 w-full px-3"
                  />
                </div>
                {values.folder && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    onClick={() => set({ folder: null })}
                  >
                    {t('clear')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('folderHint')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border/50 bg-background px-4 py-2.5">
        <p className="text-xs text-muted-foreground">{t('applyHint')}</p>
        <Button type="submit" size="sm" className="h-8">
          {t('apply')}
        </Button>
      </div>
    </form>
  )
}

function UserPicker({
  labelledBy,
  value,
  onChange,
}: {
  labelledBy: string
  value: { id: string; name: string } | null
  onChange: (user: { id: string; name: string } | null) => void
}) {
  const t = useTranslations('filterPanel')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const { users, error } = useUserSearch(open ? query : '')

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={labelledBy}
          className="h-9 w-full justify-between px-3 font-normal"
          data-field="createdBy"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? value.name || value.id : t('anyone')}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('findPerson')}
          />
          <PickerListError error={error} />
          <CommandList>
            {!error && <CommandEmpty>{t('noPeople')}</CommandEmpty>}
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__anyone"
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  {t('anyone')}
                </CommandItem>
              )}
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => {
                    onChange({
                      id: user.id,
                      name: user.displayName || user.email || user.id,
                    })
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5',
                      value?.id === user.id ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <span className="truncate">
                    {user.displayName || user.email}
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
