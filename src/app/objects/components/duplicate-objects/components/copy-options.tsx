'use client'

import { useTranslations } from 'next-intl'

import { Badge, Label, Switch } from '@/components/ui'
import { isCappedTotal, mayHaveChildren, TOTAL_CAP } from '@/lib/list-total'

import type { DuplicateSourceObject } from '../duplicate-objects-sheet'

export interface CopyOptionValues {
  includeChildren: boolean
  copyProperties: boolean
  copyFiles: boolean
  copyAddress: boolean
}

interface CopyOptionsProps {
  sources: DuplicateSourceObject[]
  values: CopyOptionValues
  onChange: (values: CopyOptionValues) => void
  disabled: boolean
}

export function CopyOptions({
  sources,
  values,
  onChange,
  disabled,
}: CopyOptionsProps) {
  const t = useTranslations()
  const set = (key: keyof CopyOptionValues) => (checked: boolean) =>
    onChange({ ...values, [key]: checked })

  const anyHasChildren = sources.some((o) => mayHaveChildren(o.childCount))
  const anyCountUnknown = sources.some((o) => o.childCount === undefined)
  const anyCountCapped = sources.some((o) => isCappedTotal(o.childCount, true))
  const totalChildCount = sources.reduce(
    (sum, o) => sum + (o.childCount ?? 0),
    0
  )

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">
        {t('objects.duplicate.options')}
      </Label>

      {anyHasChildren && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="include-children" className="text-sm font-medium">
              {t('objects.duplicate.includeChildren')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('objects.duplicate.includeChildrenHint')}
            </p>
          </div>
          <Switch
            id="include-children"
            checked={values.includeChildren}
            onCheckedChange={set('includeChildren')}
            disabled={disabled}
            data-testid="duplicate-include-children"
          />
        </div>
      )}

      {/* No sum with an unknown count in it: it would read as the whole number. */}
      {anyHasChildren &&
        values.includeChildren &&
        !anyCountUnknown &&
        totalChildCount > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-2">
            <Badge
              variant="secondary"
              className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              data-testid="duplicate-child-total"
            >
              {anyCountCapped
                ? t('objects.childrenPage.childrenCountMoreThan', {
                    count: TOTAL_CAP,
                  })
                : t('objects.duplicate.childCount', {
                    count: totalChildCount,
                  })}
            </Badge>
          </div>
        )}

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="copy-properties" className="text-sm font-medium">
          {t('objects.duplicate.copyProperties')}
        </Label>
        <Switch
          id="copy-properties"
          checked={values.copyProperties}
          onCheckedChange={set('copyProperties')}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="copy-files" className="text-sm font-medium">
            {t('objects.duplicate.copyFilesReferences')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('objects.duplicate.copyFilesHint')}
          </p>
        </div>
        <Switch
          id="copy-files"
          checked={values.copyFiles}
          onCheckedChange={set('copyFiles')}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="copy-address" className="text-sm font-medium">
          {t('objects.duplicate.copyAddress')}
        </Label>
        <Switch
          id="copy-address"
          checked={values.copyAddress}
          onCheckedChange={set('copyAddress')}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
