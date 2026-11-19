'use client'

import * as React from 'react'
import { Bookmark, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, Input, Label } from '@/components/ui'
import {
  cutName,
  type SavedSearch,
  type SavedSearchReason,
  type SavedSearchResult,
} from '@/hooks/ui/use-saved-searches'

/** Rows shown before "Show all", so Recent and Quick actions stay near on a phone. */
const FIRST_ROWS = 8

/** The text of a reason. `refused` adds the node's English detail, marked as English. */
export function useReasonText() {
  const t = useTranslations('savedSearch')
  return React.useCallback(
    (reason: SavedSearchReason, action: 'save' | 'delete' = 'save') => {
      switch (reason.code) {
        case 'duplicate':
          return { text: t('reason.duplicate', { name: reason.name }) }
        case 'refused':
          return { text: t('reason.refused'), detail: reason.detail }
        case 'failed':
          return {
            text: t(
              action === 'save' ? 'reason.failed' : 'reason.deleteFailed'
            ),
          }
        case 'busy':
          return { text: '' }
        default:
          return { text: t(`reason.${reason.code}`) }
      }
    },
    [t]
  )
}

function ReasonText({ text, detail }: { text: string; detail?: string }) {
  return (
    <>
      {text}
      {detail && (
        <>
          {' '}
          <span lang="en">{detail}</span>
        </>
      )}
    </>
  )
}

interface SaveSearchFormProps {
  id: string
  /** The search text when the row opened: the name starts as it. */
  query: string
  ready: boolean
  onSave: (name: string) => Promise<SavedSearchResult>
}

/** The inline row that names and saves the search in the box. Its own form, so Enter saves. */
export function SaveSearchForm({
  id,
  query,
  ready,
  onSave,
}: SaveSearchFormProps) {
  const t = useTranslations('savedSearch')
  const reasonText = useReasonText()
  const [name, setName] = React.useState(() => cutName(query))
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<{
    text: string
    detail?: string
  } | null>(null)
  const nameRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending || !ready) return
    setPending(true)
    const result = await onSave(name)
    setPending(false)
    if (result.ok || result.reason.code === 'busy') return
    setError(reasonText(result.reason))
    nameRef.current?.focus()
  }

  const errorId = `${id}-error`
  return (
    <form
      id={id}
      onSubmit={submit}
      aria-label={t('formLabel')}
      data-testid="save-search-form"
      className="grid gap-2 border-b border-border/50 p-4"
      noValidate
    >
      <Label htmlFor={`${id}-name`} className="text-xs">
        {t('nameLabel')}
      </Label>
      <div className="flex min-w-0 items-center gap-2">
        <Input
          ref={nameRef}
          id={`${id}-name`}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="h-8 min-w-0 flex-1"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="sm"
          aria-disabled={pending || !ready || undefined}
          aria-busy={pending || undefined}
        >
          {pending ? t('saving') : t('submit')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      {/* Always present, so a new reason is announced; focus stays on the name. */}
      <p id={errorId} role="alert" className="text-xs text-destructive">
        {error && <ReasonText {...error} />}
      </p>
    </form>
  )
}

interface SavedSearchGroupProps {
  saved: SavedSearch[]
  unreadable: string[]
  busy: boolean
  onRun: (query: string) => void
  onDelete: (key: string) => Promise<SavedSearchResult>
}

/** The "Saved" group shown with an empty input: run a saved search, or delete it. */
export function SavedSearchGroup({
  saved,
  unreadable,
  busy,
  onRun,
  onDelete,
}: SavedSearchGroupProps) {
  const t = useTranslations('savedSearch')
  const reasonText = useReasonText()
  const [showAll, setShowAll] = React.useState(false)
  const [error, setError] = React.useState<{
    text: string
    detail?: string
  } | null>(null)
  const headingId = React.useId()
  const listRef = React.useRef<HTMLUListElement>(null)
  // The button unmounts on click, so focus moves to the first row it showed.
  const focusNewRows = React.useRef(false)
  React.useEffect(() => {
    if (!showAll || !focusNewRows.current) return
    focusNewRows.current = false
    const rows =
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-run]')
    rows?.item(FIRST_ROWS)?.focus()
  }, [showAll])

  if (saved.length === 0 && unreadable.length === 0) return null

  const shown = showAll ? saved : saved.slice(0, FIRST_ROWS)
  const remove = async (key: string) => {
    if (busy) return
    setError(null)
    const result = await onDelete(key)
    if (!result.ok && result.reason.code !== 'busy') {
      setError(reasonText(result.reason, 'delete'))
    }
  }

  return (
    <div className="p-2 border-t border-border/50" data-testid="saved-searches">
      <div
        id={headingId}
        className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5"
      >
        <Bookmark className="h-3 w-3" aria-hidden />
        {t('group')}
      </div>
      <ul ref={listRef} aria-labelledby={headingId} className="grid">
        {shown.map((search) => (
          <li key={search.key} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onRun(search.query)}
              data-run
              // Named by the name only: a long query read on every row would bury the list.
              aria-labelledby={`${headingId}-${search.key}`}
              aria-describedby={`${headingId}-${search.key}-q`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bookmark
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="grid min-w-0">
                <span
                  id={`${headingId}-${search.key}`}
                  className="truncate text-sm"
                >
                  {search.name}
                </span>
                <span
                  id={`${headingId}-${search.key}-q`}
                  className="truncate font-mono text-xs text-muted-foreground"
                  title={search.query}
                >
                  {search.query}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(search.key)}
              aria-label={t('delete', { name: search.name })}
              aria-disabled={busy || undefined}
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
        {unreadable.map((key) => (
          <li key={key} className="flex min-w-0 items-center gap-1">
            <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
              <Bookmark className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{t('unreadable')}</span>
            </span>
            <button
              type="button"
              onClick={() => remove(key)}
              aria-label={t('deleteUnreadable')}
              aria-disabled={busy || undefined}
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {!showAll && saved.length > FIRST_ROWS && (
        <button
          type="button"
          onClick={() => {
            focusNewRows.current = true
            setShowAll(true)
          }}
          className="mt-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('showAll', { count: saved.length })}
        </button>
      )}
      <p role="alert" className="px-3 text-xs text-destructive">
        {error && <ReasonText {...error} />}
      </p>
    </div>
  )
}
