'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui'
import {
  getDictionaryEntry,
  matchDictionary,
  resolveKey,
  type PropertyDictionaryLocale,
  type PropertySuggestion,
} from '@/constants/property-dictionary'

export interface PropertyNameComboboxProps {
  /** The LABEL — this is a field called "Name", so it shows the name, never the stored key. */
  value: string
  /**
   * Fires on every change. `key` is the stable identifier stored on the
   * property (a dictionary key when a suggestion is picked, otherwise the
   * raw text). `label` is the display text in the user's current locale —
   * always persist both so that if the dictionary lookup ever fails the
   * fallback rendering shows readable text instead of a kebab key.
   */
  onChange: (key: string, label: string) => void
  onBlur?: () => void
  /**
   * Enter pressed with no suggestion list open — the key is settled first, so the handler reads a
   * committed value rather than the raw text. Omit it and Enter does nothing, as before.
   */
  onEnter?: () => void
  placeholder?: string
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'data-testid'?: string
}

/**
 * Input replacement that suggests standardized property names from the static
 * dictionary. The raw `Property.key` is set to the dictionary entry's stable
 * key when a suggestion is accepted; free-text is always allowed.
 */
export const PropertyNameCombobox = forwardRef<
  HTMLInputElement,
  PropertyNameComboboxProps
>(function PropertyNameCombobox(
  {
    value,
    onChange,
    onBlur,
    onEnter,
    placeholder,
    id,
    className,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'data-testid': dataTestId,
  },
  ref
) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const listboxId = useId()

  const [isOpen, setIsOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // If the stored value is a known dictionary key, show the localized label
  // in the input. Free-text values are shown as-is.
  const dictEntry = getDictionaryEntry(value)
  const displayValue = dictEntry ? dictEntry.labels[locale] : value

  const suggestions: PropertySuggestion[] = useMemo(
    () => matchDictionary(displayValue, locale),
    [displayValue, locale]
  )

  // Clamp highlight when suggestion set shrinks.
  useEffect(() => {
    if (highlighted >= suggestions.length) setHighlighted(0)
  }, [suggestions.length, highlighted])

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen])

  const acceptSuggestion = (suggestion: PropertySuggestion) => {
    onChange(suggestion.entry.key, suggestion.entry.labels[locale])
    setIsOpen(false)
  }

  /**
   * Settle the key once the user is done typing.
   *
   * On COMMIT, not per keystroke: resolving mid-word fights the input, and half a word is not a
   * term. `value` is the LABEL the user sees, so the visible text is never rewritten here — only
   * the stored key is, from the text as typed.
   */
  const commit = () => {
    const { key } = resolveKey(value)
    if (key !== '') onChange(key, value)
    onBlur?.()
  }

  const shouldShowList = isOpen && suggestions.length > 0

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShowList) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault()
        setIsOpen(true)
        setHighlighted(0)
      }
      // Only with the list CLOSED: with it open, Enter belongs to the highlighted suggestion, and
      // stealing it would submit the half-typed text the user was about to replace.
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault()
        const { key } = resolveKey(value)
        if (key !== '') onChange(key, value)
        onEnter()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      acceptSuggestion(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={shouldShowList}
        aria-controls={shouldShowList ? listboxId : undefined}
        aria-activedescendant={
          shouldShowList ? `${listboxId}-opt-${highlighted}` : undefined
        }
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        data-testid={dataTestId}
        className={cn('h-8', className)}
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          // While typing, the key mirrors the text — `commit` settles it on blur. Storing the raw
          // string here also clears any previously-bound dictionary key the moment the user edits
          // the standardized label.
          const typed = e.target.value
          onChange(typed, typed)
          setIsOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true)
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {shouldShowList && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('objects.propertyNameSuggestionsLabel')}
          data-testid="property-name-suggestions"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((s, i) => {
            const isActive = i === highlighted
            return (
              <li
                key={s.entry.key}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
                data-testid={`property-name-suggestion-${s.entry.key}`}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                onMouseDown={(e) => {
                  // Prevent input blur before click handler fires.
                  e.preventDefault()
                }}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => acceptSuggestion(s)}
              >
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{s.displayLabel}</span>
                {s.entry.category && (
                  <span className="text-xs text-muted-foreground">
                    {s.entry.category}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
