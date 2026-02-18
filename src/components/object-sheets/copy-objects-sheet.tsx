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
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useCommonApi, useCopyObjects } from '@/hooks/api'
import { ParentSelector } from '@/components/object-sheets/components'

const EMPTY_PRESELECTED: CopySourceObject[] = []

export interface CopySourceObject {
  uuid: string
  name: string
  hasChildren?: boolean
  childCount?: number
}

export interface CopyObjectsOptions {
  sourceObjects: CopySourceObject[]
  targetParentUuids: string[]
  namePrefix: string
  includeChildren: boolean
  copyProperties: boolean
  copyFiles: boolean
  copyAddress: boolean
}

interface CopyObjectsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedObjects?: CopySourceObject[]
  defaultParentUuid?: string
  onConfirm?: (options: CopyObjectsOptions) => Promise<void>
  isCopying?: boolean
}

export function CopyObjectsSheet({
  open,
  onOpenChange,
  preselectedObjects = EMPTY_PRESELECTED,
  defaultParentUuid,
  onConfirm,
  isCopying: isCopyingProp,
}: CopyObjectsSheetProps) {
  const { copyObjects, isCopying: isCopyingHook } = useCopyObjects()
  const isCopying = isCopyingProp ?? isCopyingHook
  const t = useTranslations()

  // Source object selection
  const [selectedObjects, setSelectedObjects] = useState<CopySourceObject[]>([])
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
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()
  const searchMutationRef = useRef(searchMutation)
  searchMutationRef.current = searchMutation

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
        const results = await searchMutationRef.current.mutateAsync({
          searchBy: {
            isTemplate: false,
            softDeleted: false,
          },
          ...(query && { searchTerm: query.trim() }),
          size: 10,
          page: 0,
        })

        if (results?.content) {
          setSourceSearchResults(results.content)
          setHasSourceLoaded(true)
        } else {
          setSourceSearchResults([])
          setHasSourceLoaded(true)
        }
      } catch (error) {
        logger.error('Source search failed:', error)
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
          hasChildren:
            object.hasChildren ||
            (object.children && object.children.length > 0),
          childCount: object.childCount || object.children?.length || 0,
        },
      ])
    }
  }

  const handleRemoveSource = (uuid: string) => {
    setSelectedObjects(selectedObjects.filter((o) => o.uuid !== uuid))
  }

  // Prevent selecting a source object as the target parent
  const handleParentsChange = (parentUuids: string[]) => {
    const sourceUuids = selectedObjects.map((o) => o.uuid)
    const filtered = parentUuids.filter((uuid) => !sourceUuids.includes(uuid))
    setTargetParentUuids(filtered)
  }

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm({
        sourceObjects: selectedObjects,
        targetParentUuids,
        namePrefix: namePrefix.trim(),
        includeChildren,
        copyProperties,
        copyFiles,
        copyAddress,
      })
    } else {
      await copyObjects({
        sourceUuids: selectedObjects.map((o) => o.uuid),
        targetParentUuids,
        namePrefix: namePrefix.trim(),
        includeChildren,
        copyProperties,
        copyFiles,
        copyAddress,
      })
      onOpenChange(false)
    }
  }

  const anyHasChildren = selectedObjects.some(
    (o) => o.hasChildren || (o.childCount != null && o.childCount > 0)
  )
  const totalChildCount = selectedObjects.reduce(
    (sum, o) => sum + (o.childCount || 0),
    0
  )

  const isParentLocked = !!defaultParentUuid
  const isSingleMode = preselectedObjects.length === 1

  // Set of source UUIDs for filtering in the source dropdown
  const selectedSourceUuids = new Set(selectedObjects.map((o) => o.uuid))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
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

        <div className="grid gap-5 py-4">
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
                              {(object.hasChildren ||
                                (object.children &&
                                  object.children.length > 0)) && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-xs"
                                >
                                  {object.childCount ||
                                    object.children?.length ||
                                    0}{' '}
                                  children
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
              <div className="grid gap-2">
                <Label>{t('objects.duplicate.targetParent')}</Label>
                <ParentSelector
                  initialParentUuids={targetParentUuids}
                  onParentsChange={handleParentsChange}
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
              <Label htmlFor="copy-files" className="text-sm font-medium">
                {t('objects.duplicate.copyFilesReferences')}
              </Label>
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

        <SheetFooter className="flex w-full gap-2 pt-4">
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
