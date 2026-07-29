'use client'

import { useTranslations } from 'next-intl'

import { FacetedFilter, type FacetedFilterOption } from '@/components/filters'

/** `undefined` = both kinds. */
export type TemplateTypeFilterValue = 'object' | 'process' | undefined

/**
 * Object vs process templates. `type` is a real list-query param, so this filters server-side like
 * the owner and deleted filters beside it — one table, one pagination, and search still spans both.
 *
 * Selecting both, or neither, sends no filter: "object AND process" would match nothing, which reads
 * as an empty library rather than as an impossible question.
 */
export function TemplateTypeFilter({
  value,
  onChange,
}: {
  value: TemplateTypeFilterValue
  onChange: (next: TemplateTypeFilterValue) => void
}) {
  const t = useTranslations()

  const options: FacetedFilterOption<string>[] = [
    { value: 'object', label: t('templates.typeObject') },
    { value: 'process', label: t('templates.typeProcess') },
  ]

  const selected = value ? [value] : []

  const handleChange = (values: string[]) => {
    const object = values.includes('object')
    const process = values.includes('process')
    if (object === process) return onChange(undefined)
    onChange(object ? 'object' : 'process')
  }

  return (
    <FacetedFilter
      title={t('templates.fields.type')}
      options={options}
      selected={selected}
      onSelectionChange={handleChange}
      clearLabel={t('common.clearFilters')}
      showSearch={false}
    />
  )
}
