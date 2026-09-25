'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Copy,
  Loader2,
  X,
  Check,
  ChevronsUpDown,
  Search,
  FileText,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Button,
  Label,
  Input,
  Switch,
  Badge,
  Separator,
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
import { OwnerHint } from '@/components/entity-list'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/observability/logger'
import { useIomClient } from '@/lib/io2p'
import { toast } from 'sonner'

import {
  DuplicateIntoOwnSubtreeError,
  useDuplicateObjects,
} from '@/hooks/api/use-duplicate-objects'
import { ParentSelector } from '@/app/objects/components/duplicate-objects/components'

const EMPTY_PRESELECTED: DuplicateSourceObject[] = []

export interface DuplicateSourceObject {
  uuid: string
  name: string
  childCount?: number
}

export interface DuplicateObjectsOptions {
  sourceObjects: DuplicateSourceObject[]
  targetParentUuids: string[]
  namePrefix: string
  includeChildren: boolean
  copyProperties: boolean
  copyFiles: boolean
  copyAddress: boolean
}

interface DuplicateObjectsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedObjects?: DuplicateSourceObject[]
  defaultParentUuid?: string
  onConfirm?: (options: DuplicateObjectsOptions) => Promise<void>
  isCopying?: boolean
}

export function DuplicateObjectsSheet({
  open,
  onOpenChange,
  preselectedObjects = EMPTY_PRESELECTED,
  defaultParentUuid,
  onConfirm,
  isCopying: isCopyingProp,
}: DuplicateObjectsSheetProps) {
  const { duplicateObjects, isDuplicating: isCopyingHook } =
    useDuplicateObjects()
  const isCopying = isCopyingProp ?? isCopyingHook
  const t = useTranslations()

  // Source object selection
  const [selectedObjects, setSelectedObjects] = useState<
    DuplicateSourceObject[]
  >([])
  const [isSourceOpen, setIsSourceOpen] = useState(false)
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [sourceSearchResults, setSourceSearchResults] = useState<any[]>([])
  const [isSourceSearching, setIsSourceSearching] = useState(false)
  const [hasSourceLoaded, setHasSourceLoaded] = useState(false)
  const lastSourceQueryRef = useRef('')

  // Target & options
  const [targetParentUuids, setTargetParentUuids] = useState<string[]>([])
  const [namePrefix, setNamePrefix] = useState('')
  const [includeChildren, setIncludeChildren] = useState(false)
  const [copyProperties, setCopyProperties] = useState(true)
  const [copyFiles, setCopyFiles] = useState(false)
  const [copyAddress, setCopyAddress] = useState(false)

  // Search API
  // The search is imperative (debounced, fired from a callback), so it uses the client directly
  // rather than a query hook — the same shape `use-process-graph` uses for its sweep.
  const client = useIomClient()
  const clientRef = useRef(client)
  // See attachment-section: ref writes belong in an effect, and every reader
  // here is an event handler that runs after commit.
  useEffect(() => {
    clientRef.current = client
  }, [client])

  // Reset form when sheet opens
  const resetForm = useCallback(() => {
    setSelectedObjects(preselectedObjects)
    setTargetParentUuids(defaultParentUuid ? [defaultParentUuid] : [])
    setNamePrefix('')
    setIncludeChildren(false)
    setCopyProperties(true)
    setCopyFiles(false)
    setCopyAddress(false)
    setSourceSearchQuery('')
    setSourceSearchResults([])
    setHasSourceLoaded(false)
  }, [preselectedObjects, defaultParentUuid])

  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetForm()
    }
    prevOpenRef.current = open
  }, [open, resetForm])

  // Source object search
  const performSourceSearch = useCallback(
    async (query: string = '') => {
      if (!isSourceOpen) return

      setIsSourceSearching(true)
      try {
        // `q` substring-matches name and description, which is what the old `searchTerm` did.
        // `deleted` defaults to exclude, so the retired `softDeleted: false` filter is implicit.
        const results = await clientRef.current.objects.list({
          q: query.trim() || undefined,
          size: 10,
          page: 1,
          scope: 'all',
          // Without this `childCount` is absent on every row, and the
          // "include children" switch below gates on it — so recursive copy
          // silently disappeared for anything picked by search.
          withChildCounts: true,
        })

        // The list speaks `id`; this picker's markup speaks `uuid`. Mapped here rather than
        // renaming the markup, because the sheet is due its own rewrite.
        setSourceSearchResults(results.data.map((o) => ({ ...o, uuid: o.id })))
        setHasSourceLoaded(true)
      } catch (error) {
        logger.error('Source search failed:', { err: error })
        setSourceSearchResults([])
      } finally {
        setIsSourceSearching(false)
      }
    },
    [isSourceOpen]
  )

  // Debounced source search
  useEffect(() => {
    if (!isSourceOpen) return

    const timeoutId = setTimeout(() => {
      const isClearingSearch =
        lastSourceQueryRef.current.length >= 2 && sourceSearchQuery.length < 2

      if (!sourceSearchQuery || sourceSearchQuery.length < 2) {
        if (!hasSourceLoaded || isClearingSearch) {
          performSourceSearch()
        }
      } else {
        performSourceSearch(sourceSearchQuery)
      }

      lastSourceQueryRef.current = sourceSearchQuery
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [sourceSearchQuery, isSourceOpen, hasSourceLoaded, performSourceSearch])

  // Prevent selecting an object that is already the target parent
  const handleToggleSource = (object: any) => {
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
          childCount: object.childCount ?? 0,
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

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm({
        sourceObjects: selectedObjects,
        targetParentUuids,
        namePrefix,
        includeChildren,
        copyProperties,
        copyFiles,
        copyAddress,
      })
    } else {
      try {
        await duplicateObjects({
          sourceIds: selectedObjects.map((o) => o.uuid),
          targetParentIds: targetParentUuids,
          namePrefix,
          includeChildren,
          copyProperties,
          copyFiles,
          copyAddress,
        })
        toast.success(
          t('objects.duplicate.copied', { count: selectedObjects.length })
        )
        onOpenChange(false)
      } catch (error) {
        // The loop is sequential and stops at the first failure, so an unknown
        // number of copies already exist. Saying so beats a silent no-op that
        // looks like the click never registered — the list behind the sheet has
        // already been invalidated and will show them.
        // The cycle guard runs BEFORE any write, so nothing was created and the
        // generic "some may already exist" warning would be wrong here.
        if (error instanceof DuplicateIntoOwnSubtreeError) {
          toast.error(t('objects.duplicate.targetInsideSource'))
          return
        }
        logger.error('Duplicate objects failed', { err: error })
        toast.error(t('objects.duplicate.failedPartial'))
      }
    }
  }

  const anyHasChildren = selectedObjects.some((o) => (o.childCount ?? 0) > 0)
  const totalChildCount = selectedObjects.reduce(
    (sum, o) => sum + (o.childCount || 0),
    0
  )

  const isParentLocked = !!defaultParentUuid
  const isSingleMode = preselectedObjects.length === 1

  // Set of source UUIDs for filtering in the source dropdown
  const selectedSourceUuids = new Set(selectedObjects.map((o) => o.uuid))

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
          {/* Source objects selector */}
          <div className="grid gap-2">
            <Label>{t('objects.duplicate.sourceObjects')}</Label>
            <Popover open={isSourceOpen} onOpenChange={setIsSourceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isSourceOpen}
                  aria-controls="copy-source-listbox"
                  className="w-full justify-between"
                  disabled={isCopying}
                  data-testid="duplicate-source-trigger"
                >
                  {selectedObjects.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      <span className="truncate">
                        {t('objects.duplicate.selectedCount', {
                          count: selectedObjects.length,
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('objects.duplicate.sourceObjectsHint')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0"
                align="start"
              >
                <Command shouldFilter={false} id="copy-source-listbox">
                  <div className="relative">
                    <CommandInput
                      placeholder={t('objects.duplicate.sourceObjectsHint')}
                      value={sourceSearchQuery}
                      onValueChange={setSourceSearchQuery}
                      className="ml-2"
                    />
                    {isSourceSearching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CommandList className="max-h-[300px] !overflow-y-auto overflow-x-hidden">
                    <CommandEmpty>
                      {isSourceSearching
                        ? t('common.loading')
                        : t('objects.parentSelector.noResults')}
                    </CommandEmpty>
                    <CommandGroup>
                      {sourceSearchResults
                        .filter(
                          (object: any) =>
                            !targetParentUuids.includes(object.uuid)
                        )
                        .map((object: any) => {
                          const isSelected = selectedSourceUuids.has(
                            object.uuid
                          )
                          return (
                            <CommandItem
                              key={object.uuid}
                              value={object.uuid}
                              onSelect={() => handleToggleSource(object)}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  isSelected ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium truncate">
                                {object.name || object.uuid}
                              </span>
                              <OwnerHint
                                ownerUserId={object.createdBy}
                                ownerName={object.createdByName}
                              />
                              {(object.childCount ?? 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-xs"
                                >
                                  {t('objects.duplicate.childCount', {
                                    count: object.childCount ?? 0,
                                  })}
                                </Badge>
                              )}
                            </CommandItem>
                          )
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Selected objects badges */}
            {selectedObjects.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
                {selectedObjects.map((obj) => (
                  <Badge
                    key={obj.uuid}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                    title={obj.uuid}
                  >
                    <span className="truncate max-w-32">{obj.name}</span>
                    {!isCopying && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveSource(obj.uuid)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </Badge>
                ))}
              </div>
            )}

            {selectedObjects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t('objects.duplicate.noObjectsSelected')}
              </p>
            )}
          </div>

          <Separator />

          {/* Target parent — hidden when locked via defaultParentUuid */}
          {!isParentLocked && (
            <>
              <div className="grid gap-2" data-testid="duplicate-target-parent">
                <Label>{t('objects.duplicate.targetParent')}</Label>
                <ParentSelector
                  initialParentUuids={targetParentUuids}
                  onParentsChange={handleParentsChange}
                  excludeUuids={selectedObjects.map((o) => o.uuid)}
                  placeholder={t('objects.parentSearch')}
                  maxSelections={1}
                  disabled={isCopying}
                />
              </div>
              <Separator />
            </>
          )}

          {/* Name prefix */}
          <div className="grid gap-2">
            <Label htmlFor="name-prefix">
              {t('objects.duplicate.namePrefix')}
            </Label>
            <Input
              id="name-prefix"
              placeholder={t('objects.duplicate.namePrefixPlaceholder')}
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              disabled={isCopying}
            />
            <p className="text-xs text-muted-foreground">
              {t('objects.duplicate.namePrefixHint')}
            </p>
          </div>

          <Separator />

          {/* Copy options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              {t('objects.duplicate.options')}
            </Label>

            {/* Include children */}
            {anyHasChildren && (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="include-children"
                    className="text-sm font-medium"
                  >
                    {t('objects.duplicate.includeChildren')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('objects.duplicate.includeChildrenHint')}
                  </p>
                </div>
                <Switch
                  id="include-children"
                  checked={includeChildren}
                  onCheckedChange={setIncludeChildren}
                  disabled={isCopying}
                  data-testid="duplicate-include-children"
                />
              </div>
            )}

            {/* Child count info */}
            {anyHasChildren && includeChildren && totalChildCount > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-2">
                <Badge
                  variant="secondary"
                  className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                >
                  {t('objects.duplicate.childCount', {
                    count: totalChildCount,
                  })}
                </Badge>
              </div>
            )}

            {/* Copy properties */}
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="copy-properties" className="text-sm font-medium">
                {t('objects.duplicate.copyProperties')}
              </Label>
              <Switch
                id="copy-properties"
                checked={copyProperties}
                onCheckedChange={setCopyProperties}
                disabled={isCopying}
              />
            </div>

            {/* Copy files */}
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
                checked={copyFiles}
                onCheckedChange={setCopyFiles}
                disabled={isCopying}
              />
            </div>

            {/* Copy address */}
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="copy-address" className="text-sm font-medium">
                {t('objects.duplicate.copyAddress')}
              </Label>
              <Switch
                id="copy-address"
                checked={copyAddress}
                onCheckedChange={setCopyAddress}
                disabled={isCopying}
              />
            </div>
          </div>
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
