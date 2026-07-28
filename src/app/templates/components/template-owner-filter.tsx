'use client'

import { useTranslations } from 'next-intl'

import { FacetedFilter, type FacetedFilterOption } from '@/components/filters'

/** `undefined` = both; `true` = built-in only; `false` = user-created only. */
export type TemplateOwnerFilterValue = boolean | undefined

/**
 * System vs user templates. The node filters on this server-side (`?system=`), so selecting both —
 * or neither — has to collapse back to "send no filter" rather than to an impossible query.
 */
export function TemplateOwnerFilter({
  value,
  onChange,
}: {
  value: TemplateOwnerFilterValue
  onChange: (next: TemplateOwnerFilterValue) => void
}) {
  const t = useTranslations()

  const options: FacetedFilterOption<string>[] = [
    { value: 'system', label: t('templates.systemBadge') },
    { value: 'user', label: t('templates.userBadge') },
  ]

  const selected = value === true ? ['system'] : value === false ? ['user'] : []

  const handleChange = (values: string[]) => {
    const system = values.includes('system')
    const user = values.includes('user')
    // Both or neither means no constraint — the query param is dropped entirely.
    onChange(system === user ? undefined : system)
  }

  return (
    <FacetedFilter
      title={t('templates.fields.owner')}
      options={options}
      selected={selected}
      onSelectionChange={handleChange}
      clearLabel={t('common.clearFilters')}
      showSearch={false}
    />
  )
}
