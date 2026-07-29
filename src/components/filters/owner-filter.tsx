'use client'

import { useTranslations } from 'next-intl'

import { FacetedFilter, type FacetedFilterOption } from './faceted-filter'

/** `undefined` = both; `true` = built-in only; `false` = user-created only. */
export type OwnerFilterValue = boolean | undefined

/**
 * Built-in vs user-created, for every library resource that carries a `system` flag — formulas,
 * constants and templates all do, and all filter on it server-side via `?system=`.
 *
 * Selecting both, or neither, collapses back to sending no filter rather than to an impossible
 * query: "system AND user" would return nothing, which reads as "there are none".
 */
export function OwnerFilter({
  value,
  onChange,
}: {
  value: OwnerFilterValue
  onChange: (next: OwnerFilterValue) => void
}) {
  const t = useTranslations()

  const options: FacetedFilterOption<string>[] = [
    { value: 'system', label: t('common.builtIn') },
    { value: 'user', label: t('common.userCreated') },
  ]

  const selected = value === true ? ['system'] : value === false ? ['user'] : []

  const handleChange = (values: string[]) => {
    const system = values.includes('system')
    const user = values.includes('user')
    onChange(system === user ? undefined : system)
  }

  return (
    <FacetedFilter
      title={t('common.owner')}
      options={options}
      selected={selected}
      onSelectionChange={handleChange}
      clearLabel={t('common.clearFilters')}
      showSearch={false}
    />
  )
}
