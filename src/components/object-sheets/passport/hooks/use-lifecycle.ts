import { useMemo } from 'react'

import {
  computeDateProgress,
  findValueByKey,
  parseDateValue,
  type NormalizedProperty,
} from '../utils/passport-utils'

export interface LifecycleData {
  productionDate: Date | null
  installationDate: Date | null
  lastInspection: Date | null
  nextMaintenance: Date | null
  warrantyProgress: ReturnType<typeof computeDateProgress>
  ageDays: number | null
  lifespanYears: string | null
  /** False when no lifecycle key is set — caller can skip the ribbon entirely. */
  hasAny: boolean
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Derives every value the lifecycle ribbon needs from the flat property list.
 * Pulled out of the component so the date-math/null-handling can be unit-tested
 * without rendering, and so the ribbon component stays declarative.
 *
 * `today` is captured inside the memo: the ribbon re-renders whenever
 * `properties` changes, which is the only granularity that matters for
 * day-precision math.
 */
export function useLifecycle(properties: NormalizedProperty[]): LifecycleData {
  return useMemo(() => {
    const productionDate = parseDateValue(
      findValueByKey(properties, 'production-date')
    )
    const installationDate = parseDateValue(
      findValueByKey(properties, 'installation-date')
    )
    const warrantyEnd = parseDateValue(
      findValueByKey(properties, 'warranty-end')
    )
    const lastInspection = parseDateValue(
      findValueByKey(properties, 'last-inspection')
    )
    const nextMaintenance = parseDateValue(
      findValueByKey(properties, 'next-maintenance')
    )
    const lifespanYears = findValueByKey(properties, 'lifespan-years') ?? null

    const warrantyAnchor = productionDate ?? installationDate
    const warrantyProgress = computeDateProgress(warrantyAnchor, warrantyEnd)

    const ageAnchor = installationDate ?? productionDate
    const ageDays = ageAnchor
      ? Math.max(0, Math.round((Date.now() - ageAnchor.getTime()) / MS_PER_DAY))
      : null

    const hasAny = Boolean(
      productionDate ||
      installationDate ||
      warrantyEnd ||
      lastInspection ||
      nextMaintenance ||
      lifespanYears
    )

    return {
      productionDate,
      installationDate,
      lastInspection,
      nextMaintenance,
      warrantyProgress,
      ageDays,
      lifespanYears,
      hasAny,
    }
  }, [properties])
}
