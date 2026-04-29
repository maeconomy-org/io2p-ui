'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import type { ProcessMaterial } from '../utils'

interface ProcessMaterialListProps {
  type: 'input' | 'output'
  materials: ProcessMaterial[]
  error?: string
  onAdd: () => void
  onEdit: (material: ProcessMaterial) => void
  onRemove: (material: ProcessMaterial) => void
}

export function ProcessMaterialList({
  type,
  materials,
  error,
  onAdd,
  onEdit,
  onRemove,
}: ProcessMaterialListProps) {
  const t = useTranslations()
  const tLifecycle = useTranslations('lifecycleStages')

  const isInput = type === 'input'
  const titleKey = isInput
    ? 'processes.form.inputMaterials'
    : 'processes.form.outputMaterials'
  const dotColor = isInput ? 'bg-blue-500' : 'bg-green-500'
  const lifecycleField = isInput
    ? 'inputLifecycleStage'
    : 'outputLifecycleStage'

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <div className={`w-3 h-3 ${dotColor} rounded-full`}></div>
            {t(titleKey)}
            <Badge variant="outline">{materials.length}</Badge>
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            {t('processes.form.add')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {materials.length > 0 ? (
          <div className="space-y-2">
            {materials.map((material) => (
              <div
                key={material.object.uuid}
                className="flex items-center justify-between px-3 py-2 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{material.object.name}</div>
                  {(material.quantity !== undefined || material.unit) && (
                    <div className="text-sm text-muted-foreground">
                      {material.quantity !== undefined ? material.quantity : ''}{' '}
                      {material.unit || ''}
                    </div>
                  )}
                  {material.metadata && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(material.metadata.lifecycleStage ||
                        material.metadata[lifecycleField]) && (
                        <Badge variant="outline" className="text-xs">
                          {tLifecycle(
                            material.metadata.lifecycleStage ||
                              material.metadata[lifecycleField]
                          )}
                        </Badge>
                      )}
                      {material.metadata.categoryCode && (
                        <Badge variant="secondary" className="text-xs">
                          {material.metadata.categoryCode}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(material)}
                  >
                    {t('processes.form.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(material)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{t('processes.form.empty')}</p>
          </div>
        )}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}
