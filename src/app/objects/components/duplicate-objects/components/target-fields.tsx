'use client'

import { useTranslations } from 'next-intl'

import { Input, Label, Separator } from '@/components/ui'

import { ParentSelector } from './parent-selector'

interface TargetFieldsProps {
  /** Hidden when the sheet was opened for one parent (`defaultParentUuid`). */
  showParent: boolean
  targetParentUuids: string[]
  onTargetParentsChange: (uuids: string[]) => void
  sourceUuids: string[]
  namePrefix: string
  onNamePrefixChange: (prefix: string) => void
  disabled: boolean
}

export function TargetFields({
  showParent,
  targetParentUuids,
  onTargetParentsChange,
  sourceUuids,
  namePrefix,
  onNamePrefixChange,
  disabled,
}: TargetFieldsProps) {
  const t = useTranslations()

  return (
    <>
      {showParent && (
        <>
          <div className="grid gap-2" data-testid="duplicate-target-parent">
            <Label>{t('objects.duplicate.targetParent')}</Label>
            <ParentSelector
              initialParentUuids={targetParentUuids}
              onParentsChange={onTargetParentsChange}
              excludeUuids={sourceUuids}
              placeholder={t('objects.parentSearch')}
              maxSelections={1}
              disabled={disabled}
            />
          </div>
          <Separator />
        </>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name-prefix">{t('objects.duplicate.namePrefix')}</Label>
        <Input
          id="name-prefix"
          placeholder={t('objects.duplicate.namePrefixPlaceholder')}
          value={namePrefix}
          onChange={(e) => onNamePrefixChange(e.target.value)}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          {t('objects.duplicate.namePrefixHint')}
        </p>
      </div>
    </>
  )
}
