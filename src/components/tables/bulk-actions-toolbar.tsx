'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Trash2,
  RotateCcw,
  FolderPlus,
  GitBranch,
  Loader2,
  Plus,
  X,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import type { GroupCreateDTO } from 'iom-sdk'

import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui'
import { cn, logger } from '@/lib'
import { useGroups } from '@/hooks'
import { useCommonApi } from '@/hooks/api'

interface BulkActionsToolbarProps {
  /** Number of selected rows */
  selectedCount: number
  /** Whether ALL selected objects are soft-deleted */
  allSelectedDeleted: boolean
  /** Whether ANY selected objects are non-deleted */
  hasNonDeletedSelected: boolean
  /** Callbacks */
  onBulkDelete: () => void
  onBulkRestore: () => void
  onAddToGroup: (groupUUID: string) => void
  onCreateAndAddToGroup: (name: string) => void
  onSetParent: (parentUUID: string) => void
  onClearSelection: () => void
  /** Loading states */
  isDeleting?: boolean
  isRestoring?: boolean
  isAddingToGroup?: boolean
  isSettingParent?: boolean
}

export function BulkActionsToolbar({
  selectedCount,
  allSelectedDeleted,
  hasNonDeletedSelected,
  onBulkDelete,
  onBulkRestore,
  onAddToGroup,
  onCreateAndAddToGroup,
  onSetParent,
  onClearSelection,
  isDeleting = false,
  isRestoring = false,
  isAddingToGroup = false,
  isSettingParent = false,
}: BulkActionsToolbarProps) {
  const t = useTranslations()
  const { useListGroups } = useGroups()
  const { data: groups } = useListGroups({ enabled: selectedCount > 0 })

  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)

  // Set Parent popover state
  const [isParentOpen, setIsParentOpen] = useState(false)
  const [parentSearchQuery, setParentSearchQuery] = useState('')
  const [parentSearchResults, setParentSearchResults] = useState<any[]>([])
  const [isParentSearching, setIsParentSearching] = useState(false)
  const [hasParentLoaded, setHasParentLoaded] = useState(false)

  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()
  const searchMutationRef = useRef(searchMutation)
  searchMutationRef.current = searchMutation

  const performParentSearch = useCallback(
    async (query: string = '') => {
      if (!isParentOpen) return
      setIsParentSearching(true)
      try {
        const results = await searchMutationRef.current.mutateAsync({
          searchBy: { isTemplate: false, softDeleted: false },
          ...(query && { searchTerm: query.trim() }),
          size: 8,
          page: 0,
        })
        if (results?.content) {
          setParentSearchResults(results.content)
          setHasParentLoaded(true)
        } else {
          setParentSearchResults([])
          setHasParentLoaded(true)
        }
      } catch (error) {
        logger.error('Parent search failed:', error)
        setParentSearchResults([])
      } finally {
        setIsParentSearching(false)
      }
    },
    [isParentOpen]
  )

  // Debounced parent search
  useEffect(() => {
    if (!isParentOpen) return
    const timeoutId = setTimeout(() => {
      if (!parentSearchQuery || parentSearchQuery.length < 2) {
        if (!hasParentLoaded) performParentSearch()
      } else {
        performParentSearch(parentSearchQuery)
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [parentSearchQuery, isParentOpen, hasParentLoaded, performParentSearch])

  // Reset parent search when popover closes
  useEffect(() => {
    if (!isParentOpen) {
      setParentSearchQuery('')
      setParentSearchResults([])
      setHasParentLoaded(false)
    }
  }, [isParentOpen])

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return
    onCreateAndAddToGroup(newGroupName.trim())
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  const handleSelectParent = (object: any) => {
    onSetParent(object.uuid)
    setIsParentOpen(false)
  }

  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 mb-4',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200'
      )}
    >
      {/* Left: selection count + clear */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs font-medium">
          {selectedCount}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('common.selected')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClearSelection}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Right: action buttons (button group style) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center divide-x divide-border rounded-md border bg-background shadow-sm">
          {/* Delete — shown when there are non-deleted selected */}
          {hasNonDeletedSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none first:rounded-l-md last:rounded-r-md gap-1.5 text-destructive hover:text-destructive"
              onClick={onBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {t('objects.bulk.deleteSelected')}
              </span>
            </Button>
          )}

          {/* Restore — shown when ALL selected are deleted */}
          {allSelectedDeleted && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none first:rounded-l-md last:rounded-r-md gap-1.5 text-blue-600 hover:text-blue-600"
              onClick={onBulkRestore}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {t('objects.bulk.restoreSelected')}
              </span>
            </Button>
          )}

          {/* Add to Group dropdown */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) {
                setShowNewGroupInput(false)
                setNewGroupName('')
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-none first:rounded-l-md last:rounded-r-md gap-1.5"
                disabled={isAddingToGroup}
              >
                {isAddingToGroup ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderPlus className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {t('objects.bulk.addToGroup')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Existing groups */}
              {groups && groups.length > 0 ? (
                groups.map((group: GroupCreateDTO) => (
                  <DropdownMenuItem
                    key={group.groupUUID}
                    onClick={() =>
                      group.groupUUID && onAddToGroup(group.groupUUID)
                    }
                  >
                    {group.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  {t('objects.bulk.noGroupsFound')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {/* Create new group */}
              {showNewGroupInput ? (
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('objects.bulk.groupNamePlaceholder')}
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroup()
                      if (e.key === 'Escape') {
                        setShowNewGroupInput(false)
                        setNewGroupName('')
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setShowNewGroupInput(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('objects.bulk.createNewGroup')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Set Parent — popover with search */}
          {hasNonDeletedSelected && (
            <Popover open={isParentOpen} onOpenChange={setIsParentOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-none first:rounded-l-md last:rounded-r-md gap-1.5"
                  disabled={isSettingParent}
                >
                  {isSettingParent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitBranch className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {t('objects.bulk.setParent')}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command shouldFilter={false}>
                  <div className="relative">
                    <CommandInput
                      placeholder={t(
                        'objects.parentSelector.searchPlaceholder'
                      )}
                      value={parentSearchQuery}
                      onValueChange={setParentSearchQuery}
                    />
                    {isParentSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>
                      {isParentSearching
                        ? t('objects.parentSelector.searching')
                        : t('objects.parentSelector.noResults')}
                    </CommandEmpty>
                    <CommandGroup>
                      {parentSearchResults.map((object: any) => (
                        <CommandItem
                          key={object.uuid}
                          value={object.uuid}
                          onSelect={() => handleSelectParent(object)}
                          className="cursor-pointer"
                        >
                          <Check className="h-4 w-4 opacity-0 mr-2" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate text-sm">
                              {object.name || object.uuid}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono truncate">
                              {object.uuid?.slice(0, 20)}...
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  )
}
