'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Trash2,
  RotateCcw,
  FolderPlus,
  GitBranch,
  Loader2,
  Plus,
  X,
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
} from '@/components/ui'
import { cn } from '@/lib'
import { useGroups } from '@/hooks'
import { useAuth } from '@/contexts'
import { canUserWriteRecords } from '@/lib/group-utils'
import { ParentSelector } from '@/components/object-sheets/components'

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
  const { data: allGroups } = useListGroups({ enabled: selectedCount > 0 })
  const { userUUID } = useAuth()

  // Only show groups where the user can write records
  const groups = (allGroups ?? []).filter((g: GroupCreateDTO) =>
    canUserWriteRecords(g, userUUID)
  )

  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)

  // Track selected parents for bulk set parent
  const [selectedParentUuids, setSelectedParentUuids] = useState<string[]>([])

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return
    onCreateAndAddToGroup(newGroupName.trim())
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  // Handle parent selection - just track selection, don't auto-submit
  const handleParentsChange = (parentUuids: string[]) => {
    setSelectedParentUuids(parentUuids)
  }

  // Apply parent selection - call onSetParent for each selected parent
  const handleApplyParents = () => {
    selectedParentUuids.forEach((uuid) => onSetParent(uuid))
    setSelectedParentUuids([]) // Clear after applying
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

          {/* Set Parent — using ParentSelector in compact mode */}
          {hasNonDeletedSelected && (
            <div className="flex items-center">
              <ParentSelector
                initialParentUuids={selectedParentUuids}
                onParentsChange={handleParentsChange}
                placeholder={t('objects.bulk.setParent')}
                compact
                disabled={isSettingParent}
                triggerContent={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-none rounded-l-md gap-1.5"
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
                    {selectedParentUuids.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 px-1 text-xs"
                      >
                        {selectedParentUuids.length}
                      </Badge>
                    )}
                  </Button>
                }
              />
              {selectedParentUuids.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 rounded-none rounded-r-md px-2"
                  onClick={handleApplyParents}
                  disabled={isSettingParent}
                >
                  {t('common.apply')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
