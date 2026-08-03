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
  const onCancel = vi.fn()
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
      footer={(guardUnsaved) => (
        <>
          <button type="submit">Save</button>
          <button type="button" onClick={() => guardUnsaved(onCancel)}>
            Cancel
          </button>
        </>
      )}
      {...props}
    />
  )
  return { ...view, onOpenChange, onCancel, onSubmit }
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
    const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' })
    const click = (key: string) =>
      fireEvent.click(screen.getByText(key, { exact: false }))

    it('closes straight away when clean', () => {
      const { onOpenChange } = renderShell({ isDirty: false })
      escape()
      expect(
        screen.queryByText('objects.drafts.unsaved.title')
      ).not.toBeInTheDocument()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('asks first when dirty, and stays open until answered', () => {
      const { onOpenChange } = renderShell({ isDirty: true, dirtyCount: 2 })
      escape()
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(
        screen.getByText('objects.detailsSheet.discardConfirm')
      ).toBeInTheDocument()
    })

    it('closes on Discard', () => {
      const { onOpenChange } = renderShell({ isDirty: true, dirtyCount: 2 })
      escape()
      click('objects.drafts.actions.discard')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('offers Save draft only when the caller can handle one', () => {
      renderShell({ isDirty: true, dirtyCount: 2 })
      escape()
      expect(
        screen.queryByText('objects.drafts.unsaved.saveDraft')
      ).not.toBeInTheDocument()
    })

    // The create flow: saving the draft must both persist AND close, or the user answers the
    // dialog and the sheet they were trying to leave is still sitting there.
    it('saves the draft and closes when Save draft is chosen', () => {
      const onSaveDraft = vi.fn()
      const { onOpenChange } = renderShell({
        isDirty: true,
        dirtyCount: 2,
        onSaveDraft,
      })
      escape()
      click('objects.drafts.unsaved.saveDraft')
      expect(onSaveDraft).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    // The regression this guards: Escape prompted, but the Cancel button sitting right beside Save
    // threw the work away without a word.
    it('routes the footer Cancel through the same prompt', () => {
      const { onCancel } = renderShell({ isDirty: true, dirtyCount: 2 })
      fireEvent.click(screen.getByText('Cancel'))
      expect(onCancel).not.toHaveBeenCalled()
      click('objects.drafts.actions.discard')
      expect(onCancel).toHaveBeenCalled()
    })

    it('lets a clean Cancel through without asking', () => {
      const { onCancel } = renderShell({ isDirty: false })
      fireEvent.click(screen.getByText('Cancel'))
      expect(onCancel).toHaveBeenCalled()
    })

    it('saves a draft from the Cancel prompt too', () => {
      const onSaveDraft = vi.fn()
      const { onCancel } = renderShell({
        isDirty: true,
        dirtyCount: 1,
        onSaveDraft,
      })
      fireEvent.click(screen.getByText('Cancel'))
      click('objects.drafts.unsaved.saveDraft')
      expect(onSaveDraft).toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalled()
    })

    it('warns that picked files will not survive a draft', () => {
      renderShell({
        isDirty: true,
        dirtyCount: 1,
        onSaveDraft: vi.fn(),
        droppedUploads: true,
      })
      escape()
      expect(
        screen.getByText('objects.drafts.unsaved.uploadsDropped')
      ).toBeInTheDocument()
    })

    // A tab can hold a way OUT of the sheet — Relations links to /processes — and that abandons
    // whatever the other tabs edited. So the guard has to reach inside a tab, not just the footer.
    describe('a tab that leaves the sheet', () => {
      const leaveTab = (onLeave: () => void): SheetTab => ({
        value: 'relations',
        label: 'Relations',
        dirty: false,
        content: (guardUnsaved) => (
          <button type="button" onClick={() => guardUnsaved(onLeave)}>
            Leave
          </button>
        ),
      })

      it('runs a render-prop tab with the guard', () => {
        const onLeave = vi.fn()
        renderShell({ tabs: [leaveTab(onLeave)], isDirty: false })
        fireEvent.click(screen.getByText('Leave'))
        expect(onLeave).toHaveBeenCalled()
      })

      it('asks before leaving when another tab is dirty', () => {
        const onLeave = vi.fn()
        renderShell({ tabs: [leaveTab(onLeave)], isDirty: true, dirtyCount: 3 })
        fireEvent.click(screen.getByText('Leave'))
        expect(onLeave).not.toHaveBeenCalled()
        click('objects.drafts.actions.discard')
        expect(onLeave).toHaveBeenCalled()
      })
    })
  })
})
