'use client'

import { useState } from 'react'
import { Check, Users, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useGroups } from '@/hooks'

interface GroupFilterProps {
  /** Array of selected group UUIDs */
  selectedGroupUUIDs: string[]
  /** Callback when selection changes */
  onGroupChange: (groupUUIDs: string[]) => void
  className?: string
}

/**
 * GroupFilter component using FacetedFilter pattern.
 * Shows a dashed border button with checkbox dropdown for group selection.
 */
export function GroupFilter({
  selectedGroupUUIDs,
  onGroupChange,
  className,
}: GroupFilterProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const { useListGroups } = useGroups()
  const { data: groups = [], isLoading } = useListGroups()

  const selectedSet = new Set(selectedGroupUUIDs)
  const hasSelection = selectedGroupUUIDs.length > 0

  const handleToggleGroup = (groupUUID: string) => {
    const newSet = new Set(selectedSet)
    if (newSet.has(groupUUID)) {
      newSet.delete(groupUUID)
    } else {
      newSet.add(groupUUID)
    }
    onGroupChange(Array.from(newSet))
  }

  const handleClear = () => {
    onGroupChange([])
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 border-dashed', hasSelection && 'border-solid')}
            title={t('objects.groupFilter.title')}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('objects.groupFilter.title')}
            {hasSelection && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {selectedGroupUUIDs.length}
                </Badge>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('objects.groupFilter.search')} />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? t('common.loading')
                  : t('objects.groupFilter.noGroups')}
              </CommandEmpty>
              <CommandGroup>
                {groups.map((group: any) => {
                  const isSelected = selectedSet.has(group.groupUUID)
                  return (
                    <CommandItem
                      key={group.groupUUID}
                      value={group.name}
                      onSelect={() => handleToggleGroup(group.groupUUID)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{group.name}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {hasSelection && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={handleClear}
                      className="justify-center text-center"
                    >
                      {t('common.clearFilters')}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
