import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui'
import { PropertyItem } from './property-item'
import type { UsePropertyEditorReturn } from './hooks/use-property-editor'

interface PropertySectionEditorProps {
  editor: UsePropertyEditorReturn
}

export function PropertySectionEditor({ editor }: PropertySectionEditorProps) {
  const t = useTranslations()

  return (
    <div className="space-y-4">
      {editor.properties.map((property) => {
        const propertyId = property.uuid || property._tempId || ''
        const siblingProperties = editor.availablePropertiesFor(propertyId)

        return (
          <PropertyItem
            key={propertyId}
            property={property}
            isExpanded={editor.expandedIds.has(propertyId)}
            onToggle={() => editor.toggleExpand(propertyId)}
            isEditable
            onNameChange={(name) => editor.updatePropertyName(propertyId, name)}
            onValueChange={(valueIndex, value) =>
              editor.updatePropertyValue(propertyId, valueIndex, value)
            }
            onValueFormulaChange={(valueIndex, formulaData) =>
              editor.updatePropertyValueFormula(
                propertyId,
                valueIndex,
                formulaData
              )
            }
            onAddValue={() => editor.addValue(propertyId)}
            onRemoveValue={(valueIndex) =>
              editor.removeValue(propertyId, valueIndex)
            }
            onRemove={() => editor.removeProperty(propertyId)}
            availableProperties={siblingProperties}
            isSaving={editor.isSavingProperty === propertyId}
          />
        )
      })}

      {editor.properties.length === 0 ? (
        <div className="text-center p-4 border rounded-md bg-muted/10">
          <p className="text-muted-foreground">
            {t('objects.properties.noProperties')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={editor.addProperty}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('objects.properties.addFirst')}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={editor.addProperty}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('objects.properties.add')}
        </Button>
      )}
    </div>
  )
}
