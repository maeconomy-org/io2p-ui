import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  EntitySheetShell,
  type SheetTab,
} from '@/components/entity-sheet/entity-sheet-shell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

const TABS: SheetTab[] = [
  {
    value: 'properties',
    label: 'Properties',
    dirty: false,
    content: <p>property body</p>,
  },
  { value: 'files', label: 'Files', dirty: true, content: <p>files body</p> },
  {
    value: 'details',
    label: 'Details',
    dirty: false,
    content: <p>details body</p>,
  },
]

function renderShell(
  props: Partial<React.ComponentProps<typeof EntitySheetShell>> = {}
) {
  const onOpenChange = vi.fn()
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
  const view = render(
    <EntitySheetShell
      open
      onOpenChange={onOpenChange}
      title="Wall"
      loading={false}
      editing
      isDirty={false}
      dirtyCount={0}
      onFiles={vi.fn()}
      onSubmit={onSubmit}
      footer={<button type="submit">Save</button>}
      {...props}
    />
  )
  return { ...view, onOpenChange, onSubmit }
}

describe('EntitySheetShell', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('renders the title and any badges beside it', () => {
    renderShell({ badges: <span>deleted</span> })
    // Twice on purpose: the visible heading, plus the sr-only SheetDescription Radix requires so
    // the dialog is announced with a name.
    expect(screen.getAllByText('Wall')).toHaveLength(2)
    expect(screen.getByText('deleted')).toBeInTheDocument()
  })

  it('shows the skeleton and no form while loading', () => {
    renderShell({ loading: true })
    expect(document.body.querySelector('form')).toBeNull()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('renders one trigger per tab and only the first tab body', () => {
    renderShell({ tabs: TABS })
    expect(screen.getByRole('tab', { name: /Properties/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Files/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Details/ })).toBeInTheDocument()
    expect(screen.getByText('property body')).toBeInTheDocument()
  })

  // The column count is a literal lookup because Tailwind cannot see interpolated class names —
  // a 4-tab process sheet must not silently fall back to a 3-column row.
  it('sizes the trigger row to the tab count', () => {
    const { unmount } = renderShell({ tabs: TABS })
    expect(document.body.querySelector('.grid-cols-3')).toBeTruthy()
    unmount()

    renderShell({
      tabs: [
        ...TABS,
        { value: 'flows', label: 'Flows', dirty: false, content: <p>f</p> },
      ],
    })
    expect(document.body.querySelector('.grid-cols-4')).toBeTruthy()
    expect(document.body.querySelector('.grid-cols-3')).toBeNull()
  })

  it('marks only the dirty tab with a dot', () => {
    renderShell({ tabs: TABS })
    const dot = (name: RegExp) =>
      screen.getByRole('tab', { name }).querySelector('span.rounded-full')
    expect(dot(/Files/)).toBeTruthy()
    expect(dot(/Properties/)).toBeNull()
  })

  it('renders children as a linear body when no tabs are given', () => {
    renderShell({ children: <p>create body</p> })
    expect(screen.getByText('create body')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('shows the unsaved bar only while dirty', () => {
    const { unmount } = renderShell({ isDirty: false, dirtyCount: 0 })
    expect(screen.queryByText(/unsavedChanges/)).not.toBeInTheDocument()
    unmount()

    renderShell({ isDirty: true, dirtyCount: 3 })
    expect(screen.getByText(/unsavedChanges/)).toHaveTextContent('"count":3')
  })

  // The footer's Save is type="submit", so it only works from inside the shell's <form>. Rendering
  // it as a sibling would compile, look identical, and never save.
  it('renders the footer inside the form', () => {
    const { onSubmit } = renderShell()
    const form = document.body.querySelector('form')
    expect(form).toBeTruthy()
    expect(form!.contains(screen.getByText('Save'))).toBe(true)

    fireEvent.submit(form!)
    expect(onSubmit).toHaveBeenCalled()
  })

  describe('closing with unsaved work', () => {
    it('closes without confirming when clean', () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { onOpenChange } = renderShell({ isDirty: false })
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(confirm).not.toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('keeps the sheet open when the user declines the discard prompt', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { onOpenChange } = renderShell({ isDirty: true, dirtyCount: 2 })
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('closes when the user accepts the discard prompt', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { onOpenChange } = renderShell({ isDirty: true, dirtyCount: 2 })
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
