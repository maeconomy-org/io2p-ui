'use client'

import React, { useState, useEffect } from 'react'
import { Search, Package } from 'lucide-react'
import type { UUObjectDTO } from 'iom-sdk'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  ScrollArea,
} from '@/components/ui'
import { useCommonApi } from '@/hooks/api'
import { UNIT_CATEGORIES } from '@/constants'
import { 
  LifecycleStage, 
  MaterialFlowMetadata,
  DOMAIN_CATEGORY_CODES 
} from '@/types/sankey-metadata'

const LIFECYCLE_STAGES: LifecycleStage[] = [
  'PRIMARY_INPUT',
  'SECONDARY_INPUT',
  'REUSED_COMPONENT',
  'PROCESSING',
  'COMPONENT',
  'PRODUCT',
  'USE_PHASE',
  'WASTE',
  'DISPOSAL'
]

interface ObjectSelectionData {
  object: UUObjectDTO
  quantity: number
  unit?: string
  metadata?: MaterialFlowMetadata
  customProperties?: Record<string, string>
}

interface ObjectSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ObjectSelectionData) => void
  title?: string
  initialData?: ObjectSelectionData
  materialType?: 'input' | 'output'
  showMetadataFields?: boolean
}

export function ObjectSelectionModal({
  isOpen,
  onClose,
  onSave,
  title = 'Select Object',
  initialData,
  materialType = 'input',
  showMetadataFields = true,
}: ObjectSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedObject, setSelectedObject] = useState<UUObjectDTO | null>(null)
  const [quantity, setQuantity] = useState<number | undefined>(undefined)
  const [unit, setUnit] = useState<string>('')
  
  // Metadata fields
  const [metadata, setMetadata] = useState<MaterialFlowMetadata>({})
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({})
  const [newPropertyKey, setNewPropertyKey] = useState('')
  const [newPropertyValue, setNewPropertyValue] = useState('')

  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()

  const [objects, setObjects] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search execution
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isOpen && searchTerm.trim().length >= 2) {
        setIsSearching(true)
        searchMutation
          .mutateAsync({
            searchTerm: searchTerm.trim(),
            size: 50, // Limit to 50 results
            page: 0,
          })
          .then((response) => {
            setObjects(response?.content || [])
          })
          .catch((error) => {
            console.error('Search failed:', error)
            setObjects([])
          })
          .finally(() => {
            setIsSearching(false)
          })
      } else if (searchTerm.trim().length < 2) {
        setObjects([])
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchTerm, isOpen])

  useEffect(() => {
    if (initialData) {
      setSelectedObject(initialData.object)
      setQuantity(initialData.quantity)
      setUnit(initialData.unit || '')
      setMetadata(initialData.metadata || {})
      setCustomProperties(initialData.customProperties || {})
    } else {
      setSelectedObject(null)
      setQuantity(undefined)
      setUnit('')
      setMetadata({})
      setCustomProperties({})
    }
    setSearchTerm('')
    setNewPropertyKey('')
    setNewPropertyValue('')
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedObject || !quantity) {
      return
    }

    onSave({
      object: selectedObject,
      quantity,
      ...(unit && { unit }),
      metadata: showMetadataFields ? metadata : undefined,
      customProperties: Object.keys(customProperties).length > 0 ? customProperties : undefined,
    })

    // Reset form
    setSelectedObject(null)
    setQuantity(undefined)
    setUnit('')
    setMetadata({})
    setCustomProperties({})
    setNewPropertyKey('')
    setNewPropertyValue('')
    setSearchTerm('')
    setObjects([])
  }

  // Handle metadata updates
  const updateMetadata = (field: keyof MaterialFlowMetadata, value: any) => {
    setMetadata(prev => {
      const updated = {
        ...prev,
        [field]: value
      }
      
      // Auto-determine material flags from lifecycle stage
      if (field === 'inputLifecycleStage' || field === 'outputLifecycleStage') {
        const stage = value as LifecycleStage
        updated.isReusedInput = stage === 'REUSED_COMPONENT'
        updated.isRecyclingMaterial = stage === 'SECONDARY_INPUT'
      }
      
      return updated
    })
  }

  // Handle custom properties
  const addCustomProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      setCustomProperties(prev => ({
        ...prev,
        [newPropertyKey.trim()]: newPropertyValue.trim()
      }))
      setNewPropertyKey('')
      setNewPropertyValue('')
    }
  }

  const removeCustomProperty = (key: string) => {
    setCustomProperties(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  const handleCancel = () => {
    setSelectedObject(null)
    setQuantity(undefined)
    setUnit('')
    setSearchTerm('')
    setObjects([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-4 p-1">
          {/* Search Objects */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Objects</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to search objects..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Object List */}
          <div className="space-y-2 flex-1">
            <Label>Available Objects</Label>
            <ScrollArea className="h-48 border rounded-lg">
              {isSearching ? (
                <div className="p-4 text-center text-gray-500">
                  Searching objects...
                </div>
              ) : objects.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm.trim().length >= 2
                    ? 'No objects found matching your search'
                    : 'Type at least 2 characters to search for objects'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {objects.map((object) => (
                    <div
                      key={object.uuid}
                      className={`px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedObject?.uuid === object.uuid
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedObject(object)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{object.name}</div>
                        <div className="text-xs text-gray-400">
                          {object.uuid?.slice(-8)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Selected Object Summary */}
          {selectedObject && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Selected</Badge>
                <span className="font-medium">{selectedObject.name}</span>
              </div>
            </div>
          )}

          {/* Quantity (Required) and Unit (Optional) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity || ''}
                onChange={(e) =>
                  setQuantity(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_CATEGORIES).map(
                    ([categoryKey, category]) => (
                      <div key={categoryKey}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">
                          {category.label}
                        </div>
                        {category.units.map((unitOption) => (
                          <SelectItem key={unitOption} value={unitOption}>
                            {unitOption}
                          </SelectItem>
                        ))}
                      </div>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metadata Fields */}
          {showMetadataFields && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Material Metadata (Optional)</h3>
              
              {/* Lifecycle Stage and Category - simplified field names */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lifecycleStage">
                    Lifecycle Stage
                  </Label>
                  <Select 
                    value={metadata.lifecycleStage || ''} 
                    onValueChange={(value) => updateMetadata('lifecycleStage', value as LifecycleStage)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select lifecycle stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryCode">Material Category</Label>
                  <Select 
                    value={metadata.categoryCode || ''} 
                    onValueChange={(value) => updateMetadata('categoryCode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOMAIN_CATEGORY_CODES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
          )}

          {/* Custom Properties */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">Custom Properties (Optional)</h3>
            
            {/* Existing Custom Properties */}
            {Object.entries(customProperties).length > 0 && (
              <div className="space-y-2">
                {Object.entries(customProperties).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="font-medium text-sm">{key}:</span>
                    <span className="text-sm flex-1">{value}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeCustomProperty(key)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Custom Property */}
            <div className="grid sm:grid-cols-3 gap-2">
              <Input
                placeholder="Property name"
                value={newPropertyKey}
                onChange={(e) => setNewPropertyKey(e.target.value)}
              />
              <Input
                placeholder="Property value"
                value={newPropertyValue}
                onChange={(e) => setNewPropertyValue(e.target.value)}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addCustomProperty}
                disabled={!newPropertyKey.trim() || !newPropertyValue.trim()}
              >
                Add Property
              </Button>
            </div>
          </div>

          </div>
        </ScrollArea>
        
        {/* Actions - Fixed at bottom */}
        <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row w-full gap-4 sm:justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={!selectedObject || !quantity || quantity <= 0 || !unit}
            className="flex-1"
          >
            {initialData ? 'Update' : 'Add'} Material
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ObjectSelectionModal
