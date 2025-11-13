'use client'

import { Filter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface FilterOption {
  id: string
  label: string
  checked: boolean
  icon?: React.ReactNode
}

interface FilterDropdownProps {
  options: FilterOption[]
  onOptionChange: (optionId: string, checked: boolean) => void
  label?: string
  className?: string
}

export function FilterDropdown({
  options,
  onOptionChange,
  label = 'Filters',
  className = '',
}: FilterDropdownProps) {
  const activeFiltersCount = options.filter((option) => option.checked).length

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="h-3 w-3 mr-2" />
            {label}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={option.checked}
              onCheckedChange={(checked) => onOptionChange(option.id, checked)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// DeletedFilter component using FilterDropdown
interface DeletedFilterProps {
  showDeleted: boolean
  onShowDeletedChange: (show: boolean) => void
  label?: string
  className?: string
}

export function DeletedFilter({
  showDeleted,
  onShowDeletedChange,
  label = 'Show deleted items',
  className = '',
}: DeletedFilterProps) {
  const options: FilterOption[] = [
    {
      id: 'show-deleted',
      label: label,
      checked: showDeleted,
    },
  ]

  const handleOptionChange = (optionId: string, checked: boolean) => {
    if (optionId === 'show-deleted') {
      onShowDeletedChange(checked)
    }
  }

  return (
    <FilterDropdown
      options={options}
      onOptionChange={handleOptionChange}
      label="Filters"
      className={className}
    />
  )
}
