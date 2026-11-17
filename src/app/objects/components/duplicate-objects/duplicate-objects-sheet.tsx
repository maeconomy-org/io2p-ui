'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Button,
  Separator,
} from '@/components/ui'
import {
  CopyOptions,
  SourcePicker,
  TargetFields,
} from '@/app/objects/components/duplicate-objects/components'

import type {
  CopyOptionValues,
  DuplicateObjectsOptions,
  DuplicateSourceObject,
} from './types'
import { useDuplicateSubmit } from './use-duplicate-submit'
import { useSourceSearch, type SourceSearchRow } from './use-source-search'

export type { DuplicateObjectsOptions, DuplicateSourceObject }

const EMPTY_PRESELECTED: DuplicateSourceObject[] = []

interface DuplicateObjectsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedObjects?: DuplicateSourceObject[]
  defaultParentUuid?: string
  onConfirm?: (options: DuplicateObjectsOptions) => Promise<void>
  isCopying?: boolean
}

const DEFAULT_OPTIONS: CopyOptionValues = {
  includeChildren: false,
  copyProperties: true,
  copyFiles: false,
  copyAddress: false,
}

export function DuplicateObjectsSheet({
  open,
  onOpenChange,
  preselectedObjects = EMPTY_PRESELECTED,
  defaultParentUuid,
  onConfirm,
  isCopying: isCopyingProp,
}: DuplicateObjectsSheetProps) {
  const { submit, isCopying } = useDuplicateSubmit({
    onConfirm,
    isCopying: isCopyingProp,
    onDone: () => onOpenChange(false),
  })
  const t = useTranslations()

  const [selectedObjects, setSelectedObjects] = useState<
    DuplicateSourceObject[]
  >([])
  const [isSourceOpen, setIsSourceOpen] = useState(false)
  const sourceSearch = useSourceSearch(isSourceOpen)
  const resetSourceSearch = sourceSearch.reset

  const [targetParentUuids, setTargetParentUuids] = useState<string[]>([])
  const [namePrefix, setNamePrefix] = useState('')
  const [options, setOptions] = useState(DEFAULT_OPTIONS)

  const resetForm = useCallback(() => {
    setSelectedObjects(preselectedObjects)
    setTargetParentUuids(defaultParentUuid ? [defaultParentUuid] : [])
    setNamePrefix('')
    setOptions(DEFAULT_OPTIONS)
    resetSourceSearch()
  }, [preselectedObjects, defaultParentUuid, resetSourceSearch])

  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetForm()
    }
    prevOpenRef.current = open
  }, [open, resetForm])

  // Prevent selecting an object that is already the target parent
  const handleToggleSource = (object: SourceSearchRow) => {
    if (targetParentUuids.includes(object.uuid)) return

    const isSelected = selectedObjects.some((o) => o.uuid === object.uuid)
    if (isSelected) {
      setSelectedObjects(selectedObjects.filter((o) => o.uuid !== object.uuid))
    } else {
      setSelectedObjects([
        ...selectedObjects,
        {
          uuid: object.uuid,
          name: object.name,
          childCount: object.childCount,
        },
      ])
    }
  }

  const handleRemoveSource = (uuid: string) => {
    setSelectedObjects(selectedObjects.filter((o) => o.uuid !== uuid))
  }

  // No filtering here: the picker excludes the sources itself, so there is
  // nothing to reject. Filtering the value AFTER the picker committed its own
  // state left the rejected object selected on screen while the copy went to
  // the root.
  const handleParentsChange = (parentUuids: string[]) => {
    setTargetParentUuids(parentUuids)
  }

  const handleConfirm = () =>
    submit({
      sourceObjects: selectedObjects,
      targetParentUuids,
      namePrefix,
      ...options,
    })

  const isParentLocked = !!defaultParentUuid
  const isSingleMode = preselectedObjects.length === 1

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Cancel is disabled while copying, but Escape, an outside click and the
        // built-in X are not — and the loop keeps creating objects after the
        // sheet unmounts, invisibly.
        if (isCopying && !next) return
        onOpenChange(next)
      }}
    >
      <SheetContent
        className="sm:max-w-lg flex flex-col"
        onEscapeKeyDown={(event) => {
          if (isCopying) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (isCopying) event.preventDefault()
        }}
        data-testid="duplicate-sheet"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {isSingleMode
              ? t('objects.duplicate.singleTitle')
              : t('objects.duplicate.title')}
          </SheetTitle>
          <SheetDescription>
            {isSingleMode
              ? t('objects.duplicate.singleDescription')
              : t('objects.duplicate.description')}
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto space-y-5 py-4 px-1 -mx-1">
          <SourcePicker
            search={sourceSearch}
            open={isSourceOpen}
            onOpenChange={setIsSourceOpen}
            selectedObjects={selectedObjects}
            excludeUuids={targetParentUuids}
            disabled={isCopying}
            onToggle={handleToggleSource}
            onRemove={handleRemoveSource}
          />

          <Separator />

          <TargetFields
            showParent={!isParentLocked}
            targetParentUuids={targetParentUuids}
            onTargetParentsChange={handleParentsChange}
            sourceUuids={selectedObjects.map((o) => o.uuid)}
            namePrefix={namePrefix}
            onNamePrefixChange={setNamePrefix}
            disabled={isCopying}
          />

          <Separator />

          <CopyOptions
            sources={selectedObjects}
            values={options}
            onChange={setOptions}
            disabled={isCopying}
          />
        </div>

        <SheetFooter className="flex w-full gap-2 border-t pt-4 mt-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCopying}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isCopying || selectedObjects.length === 0}
            className="flex-1"
            data-testid="duplicate-confirm"
          >
            {isCopying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('objects.duplicate.copying')}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                {t('objects.duplicate.confirm')}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
