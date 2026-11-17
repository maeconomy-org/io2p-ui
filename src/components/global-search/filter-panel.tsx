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
} from '@/components/ui'
import { useUnits } from '@/hooks/api/leaves'
import { useUserSearch } from '@/hooks/api/users'
import { cn } from '@/lib/utils'

import {
  kindOf,
  type PanelError,
  type PanelField,
  type PanelKind,
  panelQuery,
  type PanelValues,
  panelValuesOf,
} from './filter-panel-query'
import { parseSearchQuery } from './search-parser'

interface FilterPanelProps {
  id: string
  /** The search text now. It can change while the panel is open. */
  query: string
  /** False on a list that takes no numbers, dates or folder. */
  ranges: boolean
  onApply: (query: string) => void
}

/**
 * The "Add filter" form. It owns no filter state of its own: Apply writes tokens into the search
 * text, and the parser reads them as if typed.
 */
export function FilterPanel({ id, query, ranges, onApply }: FilterPanelProps) {
  const t = useTranslations('filterPanel')
  const [values, setValues] = React.useState(() =>
    panelValuesOf(parseSearchQuery(query))
  )
  const [touched, setTouched] = React.useState<ReadonlySet<PanelKind>>(
    () => new Set()
  )
  const [errors, setErrors] = React.useState<
    Partial<Record<PanelField, PanelError>>
  >({})
  const formRef = React.useRef<HTMLFormElement>(null)
  const units = useUnits({ enabled: ranges })
  const unitsListId = `${id}-units`

  const set = <K extends PanelField>(field: K, value: PanelValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    const kind = kindOf(field)
    if (kind) setTouched((prev) => new Set(prev).add(kind))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = panelQuery(query, values, ranges, touched)
    if ('errors' in result) {
      setErrors(result.errors)
      const first = Object.keys(result.errors)[0]
      formRef.current
        ?.querySelector<HTMLElement>(`[data-field="${first}"]`)
        ?.focus()
      return
    }
    onApply(result.query)
  }

  const field = (name: PanelField, label: string, input: React.ReactNode) => (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={`${id}-${name}`} className="text-xs">
        {label}
      </Label>
      {input}
      {errors[name] && (
        <p id={`${id}-${name}-error`} className="text-xs text-destructive">
          {t(`error.${errors[name]}`)}
        </p>
      )}
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
      onChange={(e) => set(name, e.target.value as never)}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
      className="h-8"
      {...extra}
    />
  )

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={submit}
      aria-label={t('title')}
      data-testid="filter-panel"
      className="grid gap-4 p-4"
      noValidate
    >
      {ranges && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t('number')}</legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {field('numberKey', t('numberKey'), textInput('numberKey'))}
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
              textInput('numberUnit', { list: unitsListId })
            )}
          </div>
          <datalist id={unitsListId}>
            {units.data?.map((unit) => (
              <option key={unit.symbol} value={unit.symbol} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">{t('numberHint')}</p>
        </fieldset>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t('property')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {field('propertyKey', t('propertyKey'), textInput('propertyKey'))}
          {field(
            'propertyValue',
            t('propertyValue'),
            textInput('propertyValue')
          )}
        </div>
      </fieldset>

      {ranges &&
        (['created', 'updated'] as const).map((kind) => (
          <fieldset key={kind} className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t(kind)}{' '}
              <span className="font-normal text-muted-foreground">
                {t('yourTimeZone')}
              </span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {field(
                `${kind}From`,
                t('dateFrom'),
                textInput(`${kind}From`, { type: 'date', min: '1970-01-01' })
              )}
              {field(
                `${kind}To`,
                t('dateTo'),
                textInput(`${kind}To`, { type: 'date', min: '1970-01-01' })
              )}
            </div>
          </fieldset>
        ))}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1">
          <Label id={`${id}-createdBy-label`} className="text-xs">
            {t('createdBy')}
          </Label>
          <UserPicker
            labelledBy={`${id}-createdBy-label`}
            value={values.createdBy}
            onChange={(user) => set('createdBy', user)}
          />
        </div>
        <div className="grid min-w-0 gap-1">
          <Label htmlFor={`${id}-deleted`} className="text-xs">
            {t('deleted')}
          </Label>
          <select
            id={`${id}-deleted`}
            value={values.deleted}
            onChange={(e) =>
              set('deleted', e.target.value as PanelValues['deleted'])
            }
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('deletedDefault')}</option>
            <option value="all">{t('deletedAll')}</option>
            <option value="true">{t('deletedOnly')}</option>
            <option value="false">{t('deletedNone')}</option>
          </select>
        </div>
      </div>

      {ranges && (
        <div className="grid min-w-0 gap-1">
          <span id={`${id}-folder-label`} className="text-xs font-medium">
            {t('folder')}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <ObjectPicker
                value={values.folder?.id ?? ''}
                displayName={values.folder?.name || undefined}
                onSelect={(folderId, name) =>
                  set('folder', { id: folderId, name })
                }
                placeholder={t('folderPlaceholder')}
                testId="filter-panel-folder"
                labelledBy={`${id}-folder-label`}
              />
            </div>
            {values.folder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set('folder', null)}
              >
                {t('clear')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('folderHint')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('applyHint')}</p>
        <Button type="submit" size="sm">
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
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={labelledBy}
          className="h-8 w-full justify-between font-normal"
          data-field="createdBy"
        >
          <span className="truncate">
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
