'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ChevronsUpDown, Package, Check } from 'lucide-react'
import {
  Button,
  Badge,
  Label,
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
  selectedMaterialUuids = [],
  onMaterialsChange,
  placeholder = 'Search for materials...',
  maxSelections = 10,
  disabled = false,
}: MaterialSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredMaterials, setFilteredMaterials] = useState<EnhancedMaterialObject[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<EnhancedMaterialObject[]>([])

  // Update selected materials when UUIDs change
  useEffect(() => {
    const selected = materials.filter(material => 
      selectedMaterialUuids.includes(material.uuid)
    )
    setSelectedMaterials(selected)
  }, [materials, selectedMaterialUuids])

  // Filter materials based on search query
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setFilteredMaterials(materials.slice(0, 20)) // Show first 20 by default
    } else {
      const filtered = materials.filter(material =>
        material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.uuid.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20) // Limit to 20 results
      setFilteredMaterials(filtered)
    }
  }, [searchQuery, materials])

  const handleSelectMaterial = (material: EnhancedMaterialObject) => {
    // Check if already selected
    const isAlreadySelected = selectedMaterialUuids.includes(material.uuid)

    let newSelectedUuids: string[]

    if (isAlreadySelected) {
      // Remove if already selected
      newSelectedUuids = selectedMaterialUuids.filter(uuid => uuid !== material.uuid)
    } else {
      // Add if not selected and under limit
      if (selectedMaterialUuids.length >= maxSelections) {
        return
      }
      newSelectedUuids = [...selectedMaterialUuids, material.uuid]
    }

    onMaterialsChange(newSelectedUuids)
  }

  const handleRemoveMaterial = (materialUuid: string) => {
    const newSelectedUuids = selectedMaterialUuids.filter(uuid => uuid !== materialUuid)
    onMaterialsChange(newSelectedUuids)
  }

  const handleClearAllMaterials = () => {
    onMaterialsChange([])
    setIsOpen(false)
  }

  return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger className="w-[355px]" asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-[350px] mr-[2px] justify-between"
            disabled={disabled}
          >
            {selectedMaterials.length > 0 ? (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="truncate">
                  {selectedMaterials.length === 1
                    ? '1 material selected'
                    : `${selectedMaterials.length} materials selected`}
                </span>
                {selectedMaterials.length >= maxSelections && (
                  <Badge variant="secondary" className="text-xs">
                    Max
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput
                placeholder="Search materials..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="ml-2"
              />
            </div>
            <CommandList className="max-h-[300px] !overflow-y-auto overflow-x-hidden">
              <CommandEmpty>
                {searchQuery.length < 2 && filteredMaterials.length === 0
                  ? 'Start typing to search for materials'
                  : 'No materials found.'}
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
              {filteredMaterials.length > 0 && materials.length > filteredMaterials.length && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t bg-muted/20">
                  Showing top {filteredMaterials.length} of {materials.length} materials • Search to find more
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  )
}
