import type { DraftProperty, DraftValue } from '@/lib/entity'

/**
 * The value a formula binds to, and the property it sits in. Matches `ref` as well as `id`: an
 * unsaved value has only a client ref, and a template value keeps its ref as the thing sibling
 * formulas bind to.
 */
export function findValue(
  properties: DraftProperty[],
  valueId: string
): { property: DraftProperty; value: DraftValue } | undefined {
  for (const property of properties) {
    const value = property.values.find(
      (v) => v.id === valueId || v.ref === valueId
    )
    if (value) return { property, value }
  }
  return undefined
}

// A deleted value still renders (struck through), but it does not count toward a summary or a badge.
export function liveValues(p: DraftProperty): DraftValue[] {
  return p.values.filter((v) => !v.deleted)
}

/** Files attached anywhere under a property: its own and its live values'. Drives the paperclip count. */
export function fileCount(p: DraftProperty): number {
  return (
    (p.files?.length ?? 0) +
    liveValues(p).reduce((n, v) => n + (v.files?.length ?? 0), 0)
  )
}
