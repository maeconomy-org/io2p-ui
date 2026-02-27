'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FacetedFilter, FacetedFilterOption } from './faceted-filter'

interface DeletedFilterProps {
  showDeleted: boolean
  onShowDeletedChange: (show: boolean) => void
  label?: string
  className?: string
  'data-tour'?: string
}

/**
 * DeletedFilter component using FacetedFilter pattern.
 * Shows a dashed border button with checkbox dropdown.
 */
export function DeletedFilter({
  showDeleted,
  onShowDeletedChange,
  className = '',
  'data-tour': dataTour,
}: DeletedFilterProps) {
  const t = useTranslations()

  const options: FacetedFilterOption<string>[] = [
    {
      value: 'show-deleted',
      label: t('objects.showDeleted'),
      // icon: <Trash2 className="h-4 w-4 text-muted-foreground" />,
    },
  ]

  const selected = showDeleted ? ['show-deleted'] : []

  const handleSelectionChange = (values: string[]) => {
    onShowDeletedChange(values.includes('show-deleted'))
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
