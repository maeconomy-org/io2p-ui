'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  Lock,
  Globe,
  Trash2,
  Users,
  Crown,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GroupCreateDTO, GroupPermission } from 'iom-sdk'

import {
  Button,
  Badge,
  Input,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useAuth } from '@/contexts'
import { useGroups } from '@/hooks/api'
import { canEditGroup, deduplicateUsersShare } from '@/lib/group-utils'

interface GroupCardProps {
  group: GroupCreateDTO
  onView: () => void
  onDelete: () => void
}

export function GroupCard({ group, onView, onDelete }: GroupCardProps) {
  const t = useTranslations()
  const { userUUID } = useAuth()
  const { useCreateGroup } = useGroups()
  const updateGroup = useCreateGroup()

  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  const isPublic = !!group.publicShare
  const usersShare = deduplicateUsersShare(group.usersShare ?? [])
  const sharedUsersCount = usersShare.length

  // Check if current user is the owner (full access)
  const isOwner = userUUID === group.ownerUserUUID

  // If not owner, check usersShare for current user's permissions
  const currentUserShare = usersShare.find((u) => u.userUUID === userUUID)
  const currentUserPermissions = isOwner
    ? (['GROUP_WRITE', 'GROUP_WRITE_RECORDS'] as GroupPermission[])
    : (currentUserShare?.permissions ?? [])

  // Can edit group if owner or has GROUP_WRITE permission
  const canWrite = isOwner || canEditGroup(currentUserPermissions)

  const handleStartEditName = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditedName(group.name)
    setIsEditingName(true)
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

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer group/card'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn(
                isPublic
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              )}
            >
              {isPublic ? (
                <Globe className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 capitalize text-xs">
                {isPublic ? t('groups.public') : t('groups.private')}
              </span>
            </Badge>
            {isOwner ? (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700 border-amber-200 text-xs"
              >
                <Crown className="h-3 w-3 mr-0.5" />
                {t('groups.owner')}
              </Badge>
            ) : (
              currentUserPermissions.length > 0 && (
                <div className="flex items-center gap-1">
                  {currentUserPermissions.map((perm) => (
                    <Badge
                      key={perm}
                      variant="secondary"
                      className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 border-gray-200"
                    >
                      {t(`groups.permissions.${perm}`)}
                    </Badge>
                  ))}
                </div>
              )
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                {t('groups.viewDetails')}
              </DropdownMenuItem>
              {canWrite && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('groups.deleteGroup')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={onView}
          >
            <h3 className="font-semibold text-lg leading-tight">
              {group.name}
            </h3>
            {canWrite && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
                onClick={handleStartEditName}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0" onClick={onView}>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{t('groups.usersCount', { count: sharedUsersCount })}</span>
        </div>
      </CardContent>
    </Card>
  )
}
