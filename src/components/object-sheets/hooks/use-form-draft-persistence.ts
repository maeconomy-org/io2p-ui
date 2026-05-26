'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'

import { useAuth } from '@/contexts'

import { objectDraftsStore } from './use-object-drafts'

interface UseFormDraftPersistenceOptions<T extends Record<string, any>> {
  form: UseFormReturn<T>
  /**
   * When provided, the hook persists changes under this id. Pass `null` to
   * defer id allocation until the user actually edits something — useful for
   * the "Create" flow so opening + closing a blank sheet doesn't pollute the
   * draft list.
   */
  draftId: string | null
  /** Sheet open / hook active. */
  isActive: boolean
  defaultValues: T
  /** Top-level fields to drop before serializing (e.g. file blobs). */
  excludeFields?: (keyof T)[]
  /** Required. Allocator called once when the first dirty change is detected
   *  and there is no active id. */
  onAllocateId: () => string
  /** Called immediately after a fresh id is allocated, so the parent can
   *  remember which draft it owns (e.g. to clear on submit). */
  onIdAllocated?: (id: string) => void
  /** How to derive the human-readable name shown in the table. */
  getDraftName: (values: T) => string
}

function isFormDirty<T extends Record<string, any>>(
  values: T,
  defaultValues: T,
  excludeFields: (keyof T)[] = []
): boolean {
  for (const key of Object.keys(values) as (keyof T)[]) {
    if (excludeFields.includes(key)) continue
    const current = values[key]
    const initial = defaultValues[key]

    if (typeof current === 'string' && typeof initial === 'string') {
      if (current.trim() !== initial.trim()) return true
    } else if (Array.isArray(current) && Array.isArray(initial)) {
      if (current.length !== initial.length) return true
      if (current.length > 0) return true
    } else if (current !== initial) {
      if (current !== undefined && current !== null) return true
    }
  }
  return false
}

/**
 * Stricter than `isFormDirty`: a draft is only worth persisting when the user
 * has entered substantive content. Name alone is not enough — otherwise a
 * single keystroke pollutes the draft list.
 */
function isDraftWorthy(values: any): boolean {
  if (Array.isArray(values?.properties) && values.properties.length > 0) {
    const hasContent = values.properties.some((p: any) => {
      if (p?.key && String(p.key).trim()) return true
      if (Array.isArray(p?.values)) {
        return p.values.some(
          (v: any) => v?.value !== undefined && String(v.value).trim()
        )
      }
      return false
    })
    if (hasContent) return true
  }
  if (Array.isArray(values?.files) && values.files.length > 0) return true
  if (values?.address?.fullAddress) return true
  if (Array.isArray(values?.parents) && values.parents.length > 0) return true
  if (values?.description && String(values.description).trim()) return true
  const name = String(values?.name ?? '').trim()
  const abbr = String(values?.abbreviation ?? '').trim()
  const version = String(values?.version ?? '').trim()
  if (name && (abbr || version)) return true
  return false
}

function stripBlobFiles(files: any[]): any[] {
  if (!Array.isArray(files)) return []
  return files.filter(
    (f: any) => f?.mode === 'reference' && (f?.url || f?.fileReference)
  )
}

function serialize<T extends Record<string, any>>(
  values: T,
  excludeFields: (keyof T)[]
): Record<string, any> {
  const toSave: any = { ...values }
  for (const field of excludeFields) {
    delete toSave[field]
  }
  if (Array.isArray(toSave.properties)) {
    toSave.properties = toSave.properties.map((prop: any) => ({
      ...prop,
      files: stripBlobFiles(prop?.files),
      values: Array.isArray(prop?.values)
        ? prop.values.map((val: any) => ({
            ...val,
            files: stripBlobFiles(val?.files),
          }))
        : prop?.values,
    }))
  }
  return toSave
}

export function useFormDraftPersistence<T extends Record<string, any>>({
  form,
  draftId,
  isActive,
  defaultValues,
  excludeFields = [],
  onAllocateId,
  onIdAllocated,
  getDraftName,
}: UseFormDraftPersistenceOptions<T>) {
  const { userUUID } = useAuth()

  // Active id is held in a ref so the watch callback always reads the latest
  // value synchronously. We mirror it into state ONLY for the public return
  // value (so consumers re-render when it changes).
  const activeIdRef = useRef<string | null>(draftId)
  const prevDraftIdRef = useRef<string | null>(draftId)
  const [activeIdForReturn, setActiveIdForReturn] = useState<string | null>(
    draftId
  )
  const isClearingRef = useRef(false)

  // Eagerly sync the ref during render when the prop changes — the previous
  // useState+useEffect approach left a one-render window where the watch
  // closure still saw `null` after the parent passed a real draftId, which
  // caused `form.reset(stored)` to allocate a *second* draft id.
  if (prevDraftIdRef.current !== draftId) {
    prevDraftIdRef.current = draftId
    activeIdRef.current = draftId
    // Defer the state update so we don't update during another component's
    // render. Safe because the ref is already correct for the watch callback.
    queueMicrotask(() => setActiveIdForReturn(draftId))
  }

  // Treat sheet open/close as a session boundary. The persisted draft (if
  // any) is identified by its id in localStorage; the in-memory ref must not
  // leak into the next open, otherwise the auto-cleanup branch in the watch
  // callback below can wipe a previously-saved draft on the first keystroke
  // of an unrelated new-create session (sheet is mounted unconditionally).
  useEffect(() => {
    activeIdRef.current = draftId
    setActiveIdForReturn(draftId)
  }, [isActive, draftId])

  const pauseSaving = useCallback(() => {
    isClearingRef.current = true
    setTimeout(() => {
      isClearingRef.current = false
    }, 0)
  }, [])

  const clearDraft = useCallback(() => {
    isClearingRef.current = true
    if (activeIdRef.current && userUUID) {
      objectDraftsStore.delete(userUUID, activeIdRef.current)
    }
    activeIdRef.current = null
    setActiveIdForReturn(null)
    setTimeout(() => {
      isClearingRef.current = false
    }, 0)
  }, [userUUID])

  const hasUnsavedChanges = useCallback((): boolean => {
    return isFormDirty(form.getValues(), defaultValues, excludeFields)
  }, [form, defaultValues, excludeFields])

  /**
   * Bypass the worthiness gate and persist current values as a draft.
   * Used by the "Save as draft" close action when a user wants to keep
   * something the auto-save threshold would otherwise drop.
   */
  const forceSaveDraft = useCallback((): string | null => {
    if (!userUUID) return null
    const values = form.getValues()
    if (!isFormDirty(values, defaultValues, excludeFields)) return null
    let id = activeIdRef.current
    if (!id) {
      id = onAllocateId()
      activeIdRef.current = id
      setActiveIdForReturn(id)
      onIdAllocated?.(id)
    }
    const payload = serialize(values, excludeFields)
    const name = getDraftName(values).trim()
    objectDraftsStore.save(userUUID, id, payload, name)
    return id
  }, [
    userUUID,
    form,
    defaultValues,
    excludeFields,
    onAllocateId,
    onIdAllocated,
    getDraftName,
  ])

  // Auto-save on every form change, gated by the worthiness predicate.
  useEffect(() => {
    if (!isActive || !userUUID) return

    const subscription = form.watch((_values, info) => {
      if (isClearingRef.current) return
      const values = form.getValues()
      if (!isFormDirty(values, defaultValues, excludeFields)) return

      // RHF emits a watcher event without `info.name` for programmatic
      // form.reset() calls, and with `info.name` set to the changed path for
      // user-driven setValue / onChange. We only auto-delete an existing
      // draft in response to *field-level* edits — otherwise a name-only draft
      // loaded via form.reset(stored) would be wiped on open (it's "dirty vs
      // blank defaults" but not "worthy" because Save-as-draft bypassed the
      // gate at save time).
      const isFieldEdit = !!info?.name

      if (!isDraftWorthy(values)) {
        if (isFieldEdit && activeIdRef.current) {
          objectDraftsStore.delete(userUUID, activeIdRef.current)
          activeIdRef.current = null
          setActiveIdForReturn(null)
        }
        return
      }

      let id = activeIdRef.current
      if (!id) {
        id = onAllocateId()
        activeIdRef.current = id
        setActiveIdForReturn(id)
        onIdAllocated?.(id)
      }
      const payload = serialize(values, excludeFields)
      const name = getDraftName(values).trim()
      objectDraftsStore.save(userUUID, id, payload, name)
    })

    return () => subscription.unsubscribe()
  }, [
    isActive,
    userUUID,
    form,
    defaultValues,
    excludeFields,
    onAllocateId,
    onIdAllocated,
    getDraftName,
  ])

  return {
    activeDraftId: activeIdForReturn,
    clearDraft,
    pauseSaving,
    hasUnsavedChanges,
    forceSaveDraft,
  }
}
