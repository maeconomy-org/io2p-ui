import type { Property } from '@/lib'

export interface TemplatePropertyDiff {
  creates: Property[]
  updates: Property[]
  deletes: Property[]
  removedValueUuids: string[]
}

/** Detect whether a property changed (key, label, value count, or indexed value/uuid). */
export function hasPropertyChanged(
  initial: Property | undefined,
  next: Property
): boolean {
  if (!initial) return true
  if (initial.key !== next.key) return true
  if ((initial.label ?? '') !== (next.label ?? '')) return true
  if ((initial.values?.length ?? 0) !== (next.values?.length ?? 0)) return true
  return next.values.some((v, i) => {
    const prev = initial.values?.[i]
    if (!prev) return true
    return prev.value !== v.value || prev.uuid !== v.uuid
  })
}

/**
 * Compute the create/update/delete buckets for a template's property list,
 * plus the uuids of values that existed on the server but were removed from
 * the form (must be soft-deleted).
 */
export function diffTemplateProperties(
  initial: Property[],
  next: Property[]
): TemplatePropertyDiff {
  const initialByUuid = new Map(
    initial.filter((p) => p.uuid).map((p) => [p.uuid as string, p])
  )
  const nextUuids = new Set(
    next.filter((p) => p.uuid).map((p) => p.uuid as string)
  )

  const creates = next.filter((p) => !p.uuid)
  const deletes = initial.filter((p) => p.uuid && !nextUuids.has(p.uuid))
  const updates = next.filter(
    (p) => p.uuid && hasPropertyChanged(initialByUuid.get(p.uuid), p)
  )

  const removedValueUuids = updates.flatMap((p) => {
    const original = initialByUuid.get(p.uuid as string)
    if (!original) return []
    const currentUuids = new Set(
      p.values.map((v) => v.uuid).filter((u): u is string => !!u)
    )
    return (original.values || [])
      .map((v) => v.uuid)
      .filter((u): u is string => !!u && !currentUuids.has(u))
  })

  return { creates, updates, deletes, removedValueUuids }
}
