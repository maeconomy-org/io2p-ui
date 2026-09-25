'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { BookOpen } from 'lucide-react'

import { PREF_FLAG, PREF_NS, flagKey } from '@/constants'
import { useFlagPreference } from '@/hooks/ui/use-preference'

const FormulaReferenceDialog = dynamic(
  () =>
    import('@/components/dialogs/formula-reference-dialog').then(
      (m) => m.FormulaReferenceDialog
    ),
  { ssr: false }
)

/**
 * Opens the formula reference at its Units section, from where units first matter to an author.
 *
 * A dialog, not a hover card: the rules are ones the author has to act on, and a hover card never
 * opens on touch and is never announced by a screen reader. The dot is the only "first time"
 * state, remembered on the server so it follows the user to another browser.
 */
export function UnitsHelp() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  // Loaded on the first open and kept mounted, so closing can still animate.
  const [opened, setOpened] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [read, markRead, resolved] = useFlagPreference(
    PREF_NS.onboarding,
    flagKey(PREF_FLAG.hint, 'formulaUnits')
  )
  const unread = resolved && !read
  // One write, whatever the timing of the optimistic update.
  const wroteRef = useRef(false)

  const label = t('objects.formulaEditor.unitsHelp')

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="formula-units-help"
        aria-label={unread ? `${label} — ${t('onboarding.hintUnread')}` : label}
        onClick={() => {
          setOpen(true)
          setOpened(true)
          if (read || wroteRef.current) return
          wroteRef.current = true
          markRead()
        }}
        className="relative inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
        {unread && (
          <span
            aria-hidden="true"
            data-testid="formula-units-help-unread"
            className="h-1.5 w-1.5 rounded-full bg-primary"
          />
        )}
      </button>
      {opened && (
        <FormulaReferenceDialog
          open={open}
          onOpenChange={setOpen}
          section="units"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            buttonRef.current?.focus()
          }}
        />
      )}
    </>
  )
}
