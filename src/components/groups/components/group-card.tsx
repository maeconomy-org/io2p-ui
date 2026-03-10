'use client'

import { useState } from 'react'
import {
  Lock,
  Globe,
  Trash2,
  Users,
  Crown,
  Pencil,
  Check,
  X,
  Loader2,
  LayoutGrid,
  Settings2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { GroupCreateDTO, GroupPermission } from 'iom-sdk'

import {
  Button,
  Badge,
  Input,
  Card,
  CardContent,
  CardHeader,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useAuth } from '@/contexts'
import { useGroups } from '@/hooks/api'
import {
  canEditGroup,
  deduplicateUsersShare,
  getEffectivePermissions,
} from '@/lib/group-utils'

interface GroupCardProps {
  group: GroupCreateDTO
  onView: () => void
  onEdit?: () => void
  onDelete: () => void
}

export function GroupCard({ group, onView, onEdit, onDelete }: GroupCardProps) {
  const t = useTranslations()
  const { userUUID } = useAuth()
  const { useCreateGroup } = useGroups()
  const updateGroup = useCreateGroup()
  const router = useRouter()

  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  const isPublic = !!group.publicShare
  const usersShare = deduplicateUsersShare(group.usersShare ?? [])
  const sharedUsersCount = usersShare.length

  // Resolve effective permissions (user-specific > public group-level > none)
  const {
    permissions: currentUserPermissions,
    isOwner,
    source: permSource,
  } = getEffectivePermissions(group, userUUID)

  // Can edit group if owner or has GROUP_WRITE permission
  const canWrite = isOwner || canEditGroup(currentUserPermissions)

  const handleStartEditName = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit()
    } else {
      setEditedName(group.name)
      setIsEditingName(true)
    }
  }

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === group.name) {
      setIsEditingName(false)
      return
    }

    try {
      await updateGroup.mutateAsync({
        ...group,
        usersShare,
        name: editedName.trim(),
      })
      setIsEditingName(false)
    } catch (error) {
      logger.error('Failed to update group name', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleViewObjects = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (group.groupUUID) {
      router.push(`/objects?groupId=${group.groupUUID}`)
    }
  }

  return (
    <Card
      data-testid={`group-card-${group.groupUUID}`}
      className={cn(
        'hover:shadow-md transition-shadow group/card flex flex-col overflow-hidden'
      )}
    >
      <CardHeader className="pb-3 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setIsEditingName(false)
                  }}
                  className="h-8 text-base font-semibold"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleSaveName}
                  disabled={updateGroup.isPending}
                >
                  {updateGroup.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsEditingName(false)}
                  disabled={updateGroup.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group/name">
                <h3
                  className="font-semibold text-lg leading-tight cursor-pointer hover:text-primary transition-colors truncate"
                  onClick={onView}
                >
                  {group.name}
                </h3>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity"
                    onClick={handleStartEditName}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title={t('groups.deleteGroup')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{t('groups.usersCount', { count: sharedUsersCount })}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                'gap-1 pointer-events-none text-[10px] h-5 px-1.5',
                isPublic
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
              )}
            >
              {isPublic ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {isPublic ? t('groups.public') : t('groups.private')}
            </Badge>
            {isOwner ? (
              <Badge
                variant="outline"
                className="gap-1 pointer-events-none text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
              >
                <Crown className="h-3 w-3" />
                {t('groups.owner')}
              </Badge>
            ) : (
              currentUserPermissions.length > 0 &&
              (currentUserPermissions.length === 1 ? (
                <Badge
                  variant="outline"
                  className="pointer-events-none text-[10px] h-5 px-1.5 bg-muted/50 text-muted-foreground border-border"
                >
                  {t(`groups.permissions.${currentUserPermissions[0]}`)}
                </Badge>
              ) : (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Badge
                      variant="outline"
                      className="cursor-help text-[10px] h-5 px-1.5 bg-muted/50 text-muted-foreground border-border"
                    >
                      {t('groups.permissionsSummary', {
                        count: currentUserPermissions.length,
                      })}
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-auto p-2" side="top">
                    <ul className="flex flex-col gap-1">
                      {currentUserPermissions.map((perm) => (
                        <li
                          key={perm}
                          className="text-[10px] font-semibold h-5 px-1.5 justify-start"
                        >
                          {t(`groups.permissions.${perm}`)}
                        </li>
                      ))}
                    </ul>
                  </HoverCardContent>
                </HoverCard>
              ))
            )}
          </div>
        </div>
      </CardHeader>

      {/* Bottom action bar */}
      <div className="border-t grid grid-cols-2 divide-x">
        <button
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={handleViewObjects}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t('groups.viewObjects')}
        </button>
        <button
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {t('groups.groupDetails')}
        </button>
      </div>
    </Card>
  )
}
