'use client'

import { useTranslations } from 'next-intl'

import { FacetedFilter, FacetedFilterOption } from './faceted-filter'

interface DeletedFilterProps {
  showDeleted: boolean
  onShowDeletedChange: (show: boolean) => void
  /** Optional second toggle — only rendered when both props are provided. */
  hideDrafts?: boolean
  onHideDraftsChange?: (hide: boolean) => void
  label?: string
  className?: string
  'data-tour'?: string
}

/**
 * Compact view-options dropdown driven by `FacetedFilter`. Always shows the
 * "Show deleted" toggle; optionally adds a "Hide drafts" toggle when the
 * caller provides those props (currently only the /objects page).
 */
export function DeletedFilter({
  showDeleted,
  onShowDeletedChange,
  hideDrafts,
  onHideDraftsChange,
  className = '',
  'data-tour': dataTour,
}: DeletedFilterProps) {
  const t = useTranslations()

  const draftsEnabled = typeof onHideDraftsChange === 'function'

  const options: FacetedFilterOption<string>[] = [
    { value: 'show-deleted', label: t('objects.showDeleted') },
    ...(draftsEnabled
      ? [{ value: 'hide-drafts', label: t('objects.drafts.hideDraftsLabel') }]
      : []),
  ]

  const selected: string[] = []
  if (showDeleted) selected.push('show-deleted')
  if (draftsEnabled && hideDrafts) selected.push('hide-drafts')

  const handleSelectionChange = (values: string[]) => {
    onShowDeletedChange(values.includes('show-deleted'))
    if (draftsEnabled) {
      onHideDraftsChange?.(values.includes('hide-drafts'))
    }
  }

  return (
    <div className={className} data-tour={dataTour}>
      <FacetedFilter
        title={t('common.filters')}
        options={options}
        selected={selected}
        onSelectionChange={handleSelectionChange}
        clearLabel={t('common.clearFilters')}
        showSearch={false}
      />
    </div>
  )
}
