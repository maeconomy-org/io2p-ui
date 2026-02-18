'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronsUpDown, Package, Check } from 'lucide-react'
import {
  Button,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { EnhancedMaterialObject } from '@/types'

const EMPTY_MATERIAL_UUIDS: string[] = []

interface MaterialSelectorProps {
  materials: EnhancedMaterialObject[]
  selectedMaterialUuids?: string[]
  onMaterialsChange: (materialUuids: string[]) => void
  placeholder?: string
  maxSelections?: number
  disabled?: boolean
}

export function MaterialSelector({
  materials,
  selectedMaterialUuids = EMPTY_MATERIAL_UUIDS,
  onMaterialsChange,
  placeholder,
  maxSelections = 10,
  disabled = false,
}: MaterialSelectorProps) {
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredMaterials, setFilteredMaterials] = useState<
    EnhancedMaterialObject[]
  >([])
  const [selectedMaterials, setSelectedMaterials] = useState<
    EnhancedMaterialObject[]
  >([])

  // Update selected materials when UUIDs change
  useEffect(() => {
    const selected = materials.filter((material) =>
      selectedMaterialUuids.includes(material.uuid)
    )
    setSelectedMaterials(selected)
  }, [materials, selectedMaterialUuids])

  // Filter materials based on search query
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setFilteredMaterials(materials.slice(0, 20)) // Show first 20 by default
    } else {
      const filtered = materials
        .filter(
          (material) =>
            material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            material.category
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            material.uuid.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 20) // Limit to 20 results
      setFilteredMaterials(filtered)
    }
  }, [searchQuery, materials])

  const handleSelectMaterial = (material: EnhancedMaterialObject) => {
    // Check if already selected
    const isAlreadySelected = selectedMaterialUuids.includes(material.uuid)

    let newSelectedUuids: string[]

    if (isAlreadySelected) {
      // Remove if already selected
      newSelectedUuids = selectedMaterialUuids.filter(
        (uuid) => uuid !== material.uuid
      )
    } else {
      // Add if not selected and under limit
      if (selectedMaterialUuids.length >= maxSelections) {
        return
      }
      newSelectedUuids = [...selectedMaterialUuids, material.uuid]
    }

    onMaterialsChange(newSelectedUuids)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="w-[355px]" asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="material-selector-listbox"
          className="w-[350px] mr-[2px] justify-between"
          disabled={disabled}
        >
          {selectedMaterials.length > 0 ? (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="truncate">
                {t('processes.materialSelector.selectedCount', {
                  count: selectedMaterials.length,
                })}
              </span>
              {selectedMaterials.length >= maxSelections && (
                <Badge variant="secondary" className="text-xs">
                  {t('processes.materialSelector.maxBadge')}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">
              {placeholder ?? t('processes.materialSelector.placeholder')}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0"
        align="start"
      >
        <Command shouldFilter={false} id="material-selector-listbox">
          <div className="relative">
            <CommandInput
              placeholder={t('processes.materialSelector.searchPlaceholder')}
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="ml-2"
            />
          </div>
          <CommandList className="max-h-[300px] !overflow-y-auto overflow-x-hidden">
            <CommandEmpty>
              {searchQuery.length < 2 && filteredMaterials.length === 0
                ? t('processes.materialSelector.startTyping')
                : t('processes.materialSelector.noResults')}
            </CommandEmpty>
            <CommandGroup>
              {filteredMaterials.map((material) => {
                const isSelected = selectedMaterialUuids.includes(material.uuid)
                return (
                  <CommandItem
                    key={material.uuid}
                    value={material.uuid}
                    onSelect={() => handleSelectMaterial(material)}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {material.name || material.uuid}
                      </div>
                      {material.category && (
                        <div className="text-xs text-muted-foreground truncate">
                          {material.category}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {filteredMaterials.length > 0 &&
              materials.length > filteredMaterials.length && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t bg-muted/20">
                  {t('processes.materialSelector.showingTop', {
                    shown: filteredMaterials.length,
                    total: materials.length,
                  })}
                </div>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
