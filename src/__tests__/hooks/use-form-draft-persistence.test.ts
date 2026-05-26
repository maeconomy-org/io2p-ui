import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import { useFormDraftPersistence } from '@/components/object-sheets/hooks/use-form-draft-persistence'
import {
  objectDraftsStore,
  indexKeyFor,
  draftKeyFor,
} from '@/components/object-sheets/hooks/use-object-drafts'

const USER_A = 'user-a-uuid'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userUUID: USER_A }),
}))

interface TestForm {
  name: string
  abbreviation: string
  version: string
  description: string
  address?: { fullAddress: string } | undefined
  parents: string[]
  properties: any[]
  files: any[]
}

const blankDefaults: TestForm = {
  name: '',
  abbreviation: '',
  version: '',
  description: '',
  address: undefined,
  parents: [],
  properties: [],
  files: [],
}

let allocCounter = 0
const makeAllocator = () => {
  allocCounter = 0
  return () => {
    allocCounter += 1
    return `draft_test_${allocCounter}`
  }
}

function setupHook(initialDraftId: string | null = null) {
  const allocator = makeAllocator()
  const allocatedIds: string[] = []
  const wrappedAllocator = () => {
    const id = allocator()
    allocatedIds.push(id)
    return id
  }

  const { result, rerender } = renderHook(
    ({ draftId, isActive }: { draftId: string | null; isActive: boolean }) => {
      const form = useForm<TestForm>({ defaultValues: blankDefaults })
      const persistence = useFormDraftPersistence<TestForm>({
        form,
        draftId,
        isActive,
        defaultValues: blankDefaults,
        excludeFields: ['files'],
        onAllocateId: wrappedAllocator,
        getDraftName: (v) => v.name || '',
      })
      return { form, persistence }
    },
    { initialProps: { draftId: initialDraftId, isActive: true } }
  )

  return { result, rerender, allocatedIds }
}

describe('useFormDraftPersistence — worthiness gate', () => {
  beforeEach(() => {
    localStorage.clear()
    allocCounter = 0
  })

  it('does NOT save when only the name field is dirty', () => {
    const { result, allocatedIds } = setupHook()

    act(() => {
      result.current.form.setValue('name', 'foo')
    })

    expect(allocatedIds).toHaveLength(0)
    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
    expect(result.current.persistence.activeDraftId).toBeNull()
  })

  it('saves when properties contain meaningful content', () => {
    const { result, allocatedIds } = setupHook()

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'color', values: [{ value: 'red' }] },
      ])
    })

    expect(allocatedIds).toHaveLength(1)
    const id = allocatedIds[0]
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    expect(objectDraftsStore.get(USER_A, id)).toMatchObject({
      properties: [{ key: 'color', values: [{ value: 'red' }] }],
    })
  })

  it('saves when address is set, even without other fields', () => {
    const { result, allocatedIds } = setupHook()

    act(() => {
      result.current.form.setValue('address', { fullAddress: '1 main st' })
    })

    expect(allocatedIds).toHaveLength(1)
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
  })

  it('saves when name + abbreviation together cross the threshold', () => {
    const { result, allocatedIds } = setupHook()

    act(() => {
      result.current.form.setValue('name', 'foo')
      result.current.form.setValue('abbreviation', 'F')
    })

    expect(allocatedIds.length).toBeGreaterThanOrEqual(1)
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
  })

  it('deletes a previously auto-saved draft when content drops below the threshold', () => {
    const { result } = setupHook()

    // Cross the threshold first.
    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
    })
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    const savedId = result.current.persistence.activeDraftId
    expect(savedId).not.toBeNull()

    // Now drop back below threshold (clear properties, leave only an empty
    // form). The watch should clean up the existing draft.
    act(() => {
      result.current.form.setValue('properties', [])
      // Need at least one dirty signal to keep watch firing — set name to
      // simulate "user kept typing but nothing substantive remains".
      result.current.form.setValue('name', 'x')
    })

    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
    expect(localStorage.getItem(draftKeyFor(USER_A, savedId!))).toBeNull()
    expect(result.current.persistence.activeDraftId).toBeNull()
  })
})

describe('useFormDraftPersistence — id allocation safety', () => {
  beforeEach(() => {
    localStorage.clear()
    allocCounter = 0
  })

  it('does NOT allocate a new id when resuming an existing draft (regression: duplicate-on-open bug)', () => {
    // Seed an existing draft.
    const existingId = 'draft_existing'
    objectDraftsStore.save(USER_A, existingId, { name: 'seeded' }, 'seeded')
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)

    const { result, allocatedIds } = setupHook(existingId)

    // Simulate the parent's "form.reset(stored)" on open. RHF fires watchers
    // synchronously during reset — that's the exact moment the previous
    // useState-based implementation read a stale `null` activeId and allocated
    // a *second* draft id.
    act(() => {
      result.current.form.reset({
        ...blankDefaults,
        name: 'seeded',
        properties: [{ key: 'k', values: [{ value: 'v' }] }],
      })
    })

    expect(allocatedIds).toEqual([])
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    expect(objectDraftsStore.read(USER_A)[0].id).toBe(existingId)
  })

  it('does NOT delete a name-only draft loaded via form.reset (regression: vanishing-on-open bug)', () => {
    // A name-only draft can only exist via the Save-as-draft escape hatch,
    // which bypasses the worthiness gate. Re-opening it triggers form.reset,
    // which in turn fires the watcher with values that ARE dirty vs blank
    // defaults but NOT worthy. The previous implementation deleted the draft
    // on that programmatic-reset watcher fire — this test pins the fix.
    const existingId = 'draft_nameonly'
    objectDraftsStore.save(
      USER_A,
      existingId,
      { name: 'just-a-name' },
      'just-a-name'
    )

    const { result } = setupHook(existingId)

    act(() => {
      result.current.form.reset({ ...blankDefaults, name: 'just-a-name' })
    })

    // Draft must still exist after the load.
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    expect(localStorage.getItem(draftKeyFor(USER_A, existingId))).not.toBeNull()
  })

  it('still deletes an under-threshold draft when the user actively edits it down', () => {
    // Counter-test: the cleanup behavior must still fire for *user* edits, so
    // a worthy draft that the user empties out doesn't linger as a stale row.
    const { result } = setupHook()

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
    })
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    const id = result.current.persistence.activeDraftId
    expect(id).not.toBeNull()

    act(() => {
      result.current.form.setValue('properties', [])
      result.current.form.setValue('name', 'still-only-name')
    })

    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
    expect(localStorage.getItem(draftKeyFor(USER_A, id!))).toBeNull()
  })

  it('does not save when isActive is false', () => {
    const { result, rerender, allocatedIds } = setupHook()
    rerender({ draftId: null, isActive: false })

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
    })

    expect(allocatedIds).toHaveLength(0)
    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
  })

  it('does NOT delete a previously-saved draft when a new session starts in the same mount (regression: stale activeIdRef bug)', () => {
    // Repro of the production bug: the create sheet is mounted unconditionally
    // and only toggled via `isActive`. After a Save-as-draft close, the hook's
    // internal activeIdRef still pointed at the saved draft id. Re-opening the
    // sheet (still mounted, draftId=null) and typing a single character into
    // a non-worthy field hit the auto-cleanup branch and wiped the previous
    // draft. The fix re-anchors activeIdRef to the draftId prop on every
    // isActive transition.
    const { result, rerender } = setupHook(null)

    // Session 1: cross the worthiness threshold, then persist via forceSaveDraft
    // (simulating "Save as draft" close).
    act(() => {
      result.current.form.setValue('name', 'first-object')
      result.current.form.setValue('abbreviation', 'FO')
    })
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    const firstDraftId = objectDraftsStore.read(USER_A)[0].id

    // Close the sheet (Save-as-draft path leaves the draft persisted).
    act(() => {
      rerender({ draftId: null, isActive: false })
    })

    // Reopen for a fresh create flow — same mount, draftId still null.
    act(() => {
      rerender({ draftId: null, isActive: true })
      // Reset to blank as the real component does on open.
      result.current.form.reset(blankDefaults)
    })

    // User starts typing the new object's name. This is a field-level edit
    // that is dirty vs defaults but NOT yet worthy — the exact condition that
    // used to wipe the previous draft.
    act(() => {
      result.current.form.setValue('name', 'x')
    })

    // The previous draft MUST survive.
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    expect(objectDraftsStore.read(USER_A)[0].id).toBe(firstDraftId)
    expect(
      localStorage.getItem(draftKeyFor(USER_A, firstDraftId))
    ).not.toBeNull()
    expect(result.current.persistence.activeDraftId).toBeNull()
  })

  it('reuses the same id across multiple worthy edits in one session', () => {
    const { result, allocatedIds } = setupHook()

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
    })
    act(() => {
      result.current.form.setValue('name', 'evolving')
    })
    act(() => {
      result.current.form.setValue('description', 'more text')
    })

    expect(allocatedIds).toHaveLength(1)
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
  })
})

describe('useFormDraftPersistence — clearDraft & forceSaveDraft', () => {
  beforeEach(() => {
    localStorage.clear()
    allocCounter = 0
  })

  it('clearDraft removes the active draft and the watch does not re-create it during reset', () => {
    const { result } = setupHook()

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
    })
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)

    act(() => {
      result.current.persistence.clearDraft()
      // Mimic the submit-success path which resets after clearing.
      result.current.form.reset(blankDefaults)
    })

    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
    expect(localStorage.getItem(indexKeyFor(USER_A))).toEqual('[]')
  })

  it('forceSaveDraft persists below-threshold content (escape hatch for "Save as draft")', () => {
    const { result, allocatedIds } = setupHook()

    // Only name set — would NOT auto-save under the worthiness gate.
    act(() => {
      result.current.form.setValue('name', 'just-a-name')
    })
    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)

    let returnedId: string | null = null
    act(() => {
      returnedId = result.current.persistence.forceSaveDraft()
    })

    expect(returnedId).not.toBeNull()
    expect(allocatedIds).toEqual([returnedId!])
    expect(objectDraftsStore.read(USER_A)).toHaveLength(1)
    expect(objectDraftsStore.get(USER_A, returnedId!)).toMatchObject({
      name: 'just-a-name',
    })
  })

  it('forceSaveDraft returns null when the form has no changes at all', () => {
    const { result } = setupHook()

    let returnedId: string | null = 'sentinel'
    act(() => {
      returnedId = result.current.persistence.forceSaveDraft()
    })

    expect(returnedId).toBeNull()
    expect(objectDraftsStore.read(USER_A)).toHaveLength(0)
  })
})

describe('useFormDraftPersistence — serialization', () => {
  beforeEach(() => {
    localStorage.clear()
    allocCounter = 0
  })

  it('strips file blobs from properties (only "reference" mode files survive)', () => {
    const { result } = setupHook()

    const blobFile = { mode: 'blob', file: new Blob(['x']) }
    const refFile = { mode: 'reference', url: 'https://example.com/a.png' }

    act(() => {
      result.current.form.setValue('properties', [
        {
          key: 'doc',
          values: [{ value: 'v', files: [blobFile, refFile] }],
          files: [blobFile, refFile],
        },
      ])
    })

    const drafts = objectDraftsStore.read(USER_A)
    expect(drafts).toHaveLength(1)
    const stored: any = objectDraftsStore.get(USER_A, drafts[0].id)
    expect(stored.properties[0].files).toEqual([refFile])
    expect(stored.properties[0].values[0].files).toEqual([refFile])
  })

  it('drops fields listed in excludeFields from the serialized payload', () => {
    const { result } = setupHook()

    act(() => {
      result.current.form.setValue('properties', [
        { key: 'k', values: [{ value: 'v' }] },
      ])
      result.current.form.setValue('files', [{ name: 'should-be-dropped' }])
    })

    const drafts = objectDraftsStore.read(USER_A)
    const stored: any = objectDraftsStore.get(USER_A, drafts[0].id)
    expect(stored.files).toBeUndefined()
  })
})
