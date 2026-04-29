'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Globe,
  Lock,
  X,
  Loader2,
  Users,
  Info,
  Check,
  Pencil,
  Crown,
  LayoutGrid,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type {
  GroupCreateDTO,
  GroupPermission,
  GroupShareToUserDTO,
} from 'iom-sdk'

import {
  Button,
  Badge,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useGroups } from '@/hooks/api'
import { useAuth } from '@/contexts'
import {
  canEditGroup,
  deduplicateUsersShare,
  getEffectivePermissions,
} from '../utils/group-utils'
import { GroupUsersTab } from './group-users-tab'
import { GroupInfoTab } from './group-info-tab'

interface GroupViewSheetProps {
  group: GroupCreateDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GroupViewSheet({
  group: groupProp,
  open,
  onOpenChange,
}: GroupViewSheetProps) {
  const [activeTab, setActiveTab] = useState('users')
  const t = useTranslations()
  const { useCreateGroup, useGetGroup } = useGroups()
  const updateGroup = useCreateGroup()
  const { userUUID } = useAuth()
  const router = useRouter()

  // Fetch live group data so changes (from mutations) are reflected immediately
  const { data: liveGroup } = useGetGroup(groupProp?.groupUUID ?? '', {
    enabled: open && !!groupProp?.groupUUID,
  })
  const group = (liveGroup ?? groupProp) as GroupCreateDTO | null

  // Inline name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  useEffect(() => {
    setActiveTab('users')
    setIsEditingName(false)
    setEditedName('')
  }, [open, groupProp?.groupUUID])

  // Deduplicate usersShare to avoid duplicate key errors and stale data
  const usersShare = useMemo(
    () => deduplicateUsersShare(group?.usersShare ?? []),
    [group?.usersShare]
  )

  if (!group) return null

  const isPublic = !!group.publicShare

  const {
    permissions: currentUserPermissions,
    isOwner,
    source: permSource,
  } = getEffectivePermissions(group, userUUID)

  const canWrite = isOwner || canEditGroup(currentUserPermissions)

  // Wraps a group mutation so every handler logs + toasts on failure with the
  // same shape. Each handler used to swallow errors silently; users would see
  // nothing happen and assume the action worked.
  const runGroupMutation = async (
    label: string,
    payload: GroupCreateDTO,
    errorKey:
      | 'updateName'
      | 'addUser'
      | 'removeUser'
      | 'updatePermission'
      | 'toggleVisibility'
  ): Promise<boolean> => {
    try {
      await updateGroup.mutateAsync(payload)
      return true
    } catch (error) {
      logger.error(label, {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error(t(`groups.errors.${errorKey}`))
      return false
    }
  }

  const handleSaveName = async () => {
    const trimmed = editedName.trim()
    if (!trimmed || trimmed === group.name) {
      setIsEditingName(false)
      return
    }
    const ok = await runGroupMutation(
      'Failed to update group name',
      { ...group, usersShare, name: trimmed },
      'updateName'
    )
    if (ok) setIsEditingName(false)
  }

  const handleStartEditName = () => {
    setEditedName(group.name)
    setIsEditingName(true)
  }

  const handleAddUser = async (
    newShare: GroupShareToUserDTO
  ): Promise<void> => {
    await runGroupMutation(
      'Failed to add user to group',
      { ...group, usersShare: [...usersShare, newShare] },
      'addUser'
    )
  }

  const handleRemoveUser = async (targetUserUUID: string): Promise<void> => {
    await runGroupMutation(
      'Failed to remove user from group',
      {
        ...group,
        usersShare: usersShare.filter((u) => u.userUUID !== targetUserUUID),
      },
      'removeUser'
    )
  }

  const handleUpdatePermissions = async (
    targetUserUUID: string,
    permissions: GroupPermission[]
  ): Promise<void> => {
    await runGroupMutation(
      'Failed to update user permission',
      {
        ...group,
        usersShare: usersShare.map((u) =>
          u.userUUID === targetUserUUID ? { ...u, permissions } : u
        ),
      },
      'updatePermission'
    )
  }

  const handleTogglePublic = async (checked: boolean): Promise<void> => {
    await runGroupMutation(
      'Failed to update group visibility',
      {
        ...group,
        usersShare,
        publicShare: checked
          ? { permissions: ['READ' as GroupPermission] }
          : undefined,
      },
      'toggleVisibility'
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader className="space-y-4 mb-4 pb-4 border-b flex-shrink-0">
          <div className="space-y-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setIsEditingName(false)
                  }}
                  className="text-2xl font-semibold h-auto py-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={updateGroup.isPending}
                  aria-label={t('common.save')}
                >
                  {updateGroup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingName(false)}
                  disabled={updateGroup.isPending}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SheetTitle className="text-2xl">{group.name}</SheetTitle>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEditName}
                    className="h-7 w-7 p-0"
                    disabled={updateGroup.isPending}
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={cn(
                  isPublic
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                )}
              >
                {isPublic ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span className="ml-1 capitalize">
                  {isPublic ? t('groups.public') : t('groups.private')}
                </span>
              </Badge>
              {isOwner ? (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-700 border-amber-200"
                >
                  <Crown className="h-3.5 w-3.5 mr-1" />
                  {t('groups.owner')}
                </Badge>
              ) : (
                currentUserPermissions.length > 0 && (
                  <div className="flex items-center gap-1">
                    {currentUserPermissions.map((perm) => (
                      <Badge
                        key={perm}
                        variant="secondary"
                        className={cn(
                          'text-[10px] h-5 px-1',
                          permSource === 'public'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        )}
                      >
                        {t(`groups.permissions.${perm}`)}
                      </Badge>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="users" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('groups.users')}
              </TabsTrigger>
              <TabsTrigger value="info" className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                {t('groups.info')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="flex-1 overflow-hidden mt-2">
              <GroupUsersTab
                group={group}
                usersShare={usersShare}
                canWrite={canWrite}
                isPending={updateGroup.isPending}
                onAddUser={handleAddUser}
                onRemoveUser={handleRemoveUser}
                onUpdatePermissions={handleUpdatePermissions}
              />
            </TabsContent>

            <TabsContent value="info" className="flex-1 overflow-auto mt-2">
              <GroupInfoTab
                group={group}
                isPublic={isPublic}
                isOwner={isOwner}
                canWrite={canWrite}
                isPending={updateGroup.isPending}
                currentUserPermissions={currentUserPermissions}
                permSource={permSource}
                onTogglePublic={handleTogglePublic}
              />
            </TabsContent>
          </Tabs>
        </div>

        {group.groupUUID && (
          <SheetFooter className="flex-shrink-0 pt-4 border-t mt-4">
            <Button
              className="w-full"
              onClick={() => {
                router.push(`/objects?groupId=${group.groupUUID}`)
                onOpenChange(false)
              }}
              disabled={updateGroup.isPending}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              {t('groups.viewObjects')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
