import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'

/**
 * Regression test for the "stale state on sheet close/reopen" bug.
 *
 * The fix in `object-details-sheet.tsx` increments an `openSession` counter
 * on every false→true transition of `isOpen` and uses it (combined with the
 * object uuid) as a `key` on the sheet body. That forces the entire stateful
 * subtree — including `usePropertyEditor`, `useAddressManagement`,
 * `useParentManagement`, `useObjectOperations`, `PropertiesTab.isEditing`,
 * etc. — to remount on each open, dropping any in-progress edits.
 *
 * These tests verify the *mechanism* by reproducing the same render-time
 * prev-state pattern around a tiny stateful child and asserting the child's
 * state is fresh after a close/reopen cycle. If this pattern ever regresses
 * (e.g. someone reverts to `useEffect`-only), the bug returns silently — so
 * locking the pattern in test form is the regression we care about.
 */

interface SheetFixtureProps {
  isOpen: boolean
  uuid?: string
}

function SheetFixture({ isOpen, uuid }: SheetFixtureProps) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [openSession, setOpenSession] = useState(0)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) setOpenSession((s) => s + 1)
  }
  const sessionKey = `${uuid ?? 'none'}:${openSession}`
  return <Body key={sessionKey} />
}

function Body() {
  // Stand-in for any state inside usePropertyEditor / PropertiesTab.isEditing
  // / useAddressManagement etc. — anything that survives across renders if
  // the component itself isn't remounted.
  const [draft, setDraft] = useState('')
  return (
    <div>
      <span data-testid="draft">{draft}</span>
      <button
        type="button"
        data-testid="set-draft"
        onClick={() => setDraft('unsaved-property-name')}
      >
        set draft
      </button>
    </div>
  )
}

describe('ObjectDetailsSheet open-session remount', () => {
  it('drops draft state on the same uuid when the sheet reopens', () => {
    const { getByTestId, rerender } = render(
      <SheetFixture isOpen uuid="object-A" />
    )

    fireEvent.click(getByTestId('set-draft'))
    expect(getByTestId('draft').textContent).toBe('unsaved-property-name')

    rerender(<SheetFixture isOpen={false} uuid="object-A" />)
    rerender(<SheetFixture isOpen uuid="object-A" />)

    expect(getByTestId('draft').textContent).toBe('')
    cleanup()
  })

  it('drops draft state when the user reopens a different object', () => {
    const { getByTestId, rerender } = render(
      <SheetFixture isOpen uuid="object-A" />
    )
    fireEvent.click(getByTestId('set-draft'))
    expect(getByTestId('draft').textContent).toBe('unsaved-property-name')

    rerender(<SheetFixture isOpen={false} uuid="object-A" />)
    rerender(<SheetFixture isOpen uuid="object-B" />)

    expect(getByTestId('draft').textContent).toBe('')
    cleanup()
  })

  it('preserves draft state across renders that are NOT close/reopen cycles', () => {
    // Sanity check: if someone re-renders the parent for unrelated reasons
    // (e.g. a sibling state change) without isOpen flipping, the draft must
    // NOT be wiped — that would over-fire the reset and feel buggy in the
    // opposite direction.
    const { getByTestId, rerender } = render(
      <SheetFixture isOpen uuid="object-A" />
    )
    fireEvent.click(getByTestId('set-draft'))
    expect(getByTestId('draft').textContent).toBe('unsaved-property-name')

    rerender(<SheetFixture isOpen uuid="object-A" />)
    rerender(<SheetFixture isOpen uuid="object-A" />)

    expect(getByTestId('draft').textContent).toBe('unsaved-property-name')
    cleanup()
  })

  it('drops edit-mode flags for ALL sibling sections on reopen', () => {
    // The real sheet has multiple `EditableSection`s sharing one
    // `activeEditingSection` string — plus tab-local `isEditing` flags
    // (PropertiesTab) and a dozen draft fields across `useAddressManagement`,
    // `useParentManagement`, `useObjectOperations`, `usePropertyEditor`. They
    // are all peers inside the keyed subtree, so a remount must wipe ALL of
    // them in a single shot. Reproduce that shape with three sibling drafts.
    function MultiBody() {
      const [activeSection, setActiveSection] = useState<string | null>(null)
      const [propertyDraft, setPropertyDraft] = useState('')
      const [parentDraft, setParentDraft] = useState<string[]>([])
      return (
        <>
          <span data-testid="active-section">{activeSection ?? 'none'}</span>
          <span data-testid="property-draft">{propertyDraft}</span>
          <span data-testid="parent-draft">{parentDraft.join(',')}</span>
          <button
            type="button"
            data-testid="enter-metadata-edit"
            onClick={() => setActiveSection('metadata')}
          >
            edit metadata
          </button>
          <button
            type="button"
            data-testid="add-property-row"
            onClick={() => setPropertyDraft('abandoned-row')}
          >
            add property
          </button>
          <button
            type="button"
            data-testid="add-parent"
            onClick={() => setParentDraft(['parent-uuid-A'])}
          >
            add parent
          </button>
        </>
      )
    }

    function MultiFixture({ isOpen, uuid }: SheetFixtureProps) {
      const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
      const [openSession, setOpenSession] = useState(0)
      if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen)
        if (isOpen) setOpenSession((s) => s + 1)
      }
      return <MultiBody key={`${uuid ?? 'none'}:${openSession}`} />
    }

    const { getByTestId, rerender } = render(
      <MultiFixture isOpen uuid="object-A" />
    )

    fireEvent.click(getByTestId('enter-metadata-edit'))
    fireEvent.click(getByTestId('add-property-row'))
    fireEvent.click(getByTestId('add-parent'))
    expect(getByTestId('active-section').textContent).toBe('metadata')
    expect(getByTestId('property-draft').textContent).toBe('abandoned-row')
    expect(getByTestId('parent-draft').textContent).toBe('parent-uuid-A')

    rerender(<MultiFixture isOpen={false} uuid="object-A" />)
    rerender(<MultiFixture isOpen uuid="object-A" />)

    expect(getByTestId('active-section').textContent).toBe('none')
    expect(getByTestId('property-draft').textContent).toBe('')
    expect(getByTestId('parent-draft').textContent).toBe('')
    cleanup()
  })
})
