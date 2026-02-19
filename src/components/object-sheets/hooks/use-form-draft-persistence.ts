'use client'

import { useEffect, useCallback, useRef } from 'react'
import { UseFormReturn } from 'react-hook-form'

const STORAGE_KEY_PREFIX = 'iom-form-draft:'

interface UseFormDraftPersistenceOptions<T extends Record<string, any>> {
  form: UseFormReturn<T>
  storageKey: string
  isActive: boolean
  defaultValues: T
  /** Fields to exclude from persistence (e.g. files that can't be serialized) */
  excludeFields?: (keyof T)[]
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

export function useFormDraftPersistence<T extends Record<string, any>>({
  form,
  storageKey,
  isActive,
  defaultValues,
  excludeFields = [],
}: UseFormDraftPersistenceOptions<T>) {
  const fullKey = `${STORAGE_KEY_PREFIX}${storageKey}`
  // Guard: when we're in the middle of clearing, suppress any watch-triggered saves
  const isClearingRef = useRef(false)

  // Strip blob/upload files from a value - only keep URL reference files
  const stripBlobFiles = (files: any[]): any[] => {
    if (!Array.isArray(files)) return []
    return files.filter(
      (f: any) => f?.mode === 'reference' && (f?.url || f?.fileReference)
    )
  }

  // Save current form values to localStorage
  const saveDraft = useCallback(() => {
    if (isClearingRef.current) return
    try {
      const values = form.getValues()
      const toSave = { ...values }
      // Strip top-level files (blobs can't be serialized)
      for (const field of excludeFields) {
        delete toSave[field]
      }
      // Strip blob/upload files from properties - only keep URL references
      const toSaveAny = toSave as any
      if (Array.isArray(toSaveAny.properties)) {
        toSaveAny.properties = toSaveAny.properties.map((prop: any) => ({
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
      localStorage.setItem(fullKey, JSON.stringify(toSave))
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [form, fullKey, excludeFields])

  // Load draft from localStorage
  const loadDraft = useCallback((): Partial<T> | null => {
    try {
      const stored = localStorage.getItem(fullKey)
      if (!stored) return null
      return JSON.parse(stored) as Partial<T>
    } catch {
      return null
    }
  }, [fullKey])

  // Temporarily pause auto-saving (survives one tick of watch callbacks)
  const pauseSaving = useCallback(() => {
    isClearingRef.current = true
    setTimeout(() => {
      isClearingRef.current = false
    }, 0)
  }, [])

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    isClearingRef.current = true
    try {
      localStorage.removeItem(fullKey)
    } catch {
      // Silently fail
    }
    // Allow saves again on next tick (after any pending watch callbacks fire)
    setTimeout(() => {
      isClearingRef.current = false
    }, 0)
  }, [fullKey])

  // Check if there is a saved draft with meaningful data
  const hasDraft = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(fullKey)
      if (!stored) return false
      const draft = JSON.parse(stored) as Partial<T>
      // Check if the draft has any meaningful data (not just empty defaults)
      return isFormDirty(draft as T, defaultValues, excludeFields)
    } catch {
      return false
    }
  }, [fullKey, defaultValues, excludeFields])

  // Restore draft into the form
  const restoreDraft = useCallback(() => {
    const draft = loadDraft()
    if (draft) {
      form.reset({ ...defaultValues, ...draft } as T)
    }
  }, [loadDraft, form, defaultValues])

  // Check if current form has meaningful data entered
  const hasUnsavedChanges = useCallback((): boolean => {
    const values = form.getValues()
    return isFormDirty(values, defaultValues, excludeFields)
  }, [form, defaultValues, excludeFields])

  // Auto-save on every form change via subscription
  useEffect(() => {
    if (!isActive) return

    const subscription = form.watch(() => {
      saveDraft()
    })

    return () => subscription.unsubscribe()
  }, [isActive, form, saveDraft])

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    pauseSaving,
    hasDraft,
    restoreDraft,
    hasUnsavedChanges,
  }
}
