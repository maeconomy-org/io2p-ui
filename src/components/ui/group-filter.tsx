'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useGroups } from '@/hooks'

interface GroupFilterProps {
  selectedGroupUUID: string | null
  onGroupChange: (groupUUID: string | null) => void
  className?: string
}

export function GroupFilter({
  selectedGroupUUID,
  onGroupChange,
  className,
}: GroupFilterProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const { useListGroups } = useGroups()
  const { data: groups = [], isLoading } = useListGroups()

  const selectedGroup = groups.find(
    (g: any) => g.groupUUID === selectedGroupUUID
  )

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 justify-between"
            title={t('objects.groupFilter.title')}
          >
            <Users className="h-3 w-3 mr-1.5" />
            <span className="max-w-[120px] truncate">
              {selectedGroup
                ? (selectedGroup as any).name
                : t('objects.groupFilter.allGroups')}
            </span>
            <ChevronsUpDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
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
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onGroupChange(null)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      !selectedGroupUUID ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {t('objects.groupFilter.allGroups')}
                </CommandItem>
                {groups.map((group: any) => (
                  <CommandItem
                    key={group.groupUUID}
                    value={group.name}
                    onSelect={() => {
                      onGroupChange(group.groupUUID)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedGroupUUID === group.groupUUID
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {group.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedGroupUUID && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onGroupChange(null)}
          title={t('objects.groupFilter.clear')}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
