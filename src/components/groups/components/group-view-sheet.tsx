'use client'

import { useState, useMemo } from 'react'
import {
  Globe,
  Lock,
  Plus,
  X,
  Loader2,
  Users,
  Info,
  Trash2,
  Check,
  Pencil,
  UserPlus,
  Crown,
  AlertCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  SheetHeader,
  SheetTitle,
  CopyButton,
  ScrollArea,
  Checkbox,
  Separator,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useGroups } from '@/hooks/api'
import { useAuth } from '@/contexts'
import { canEditGroup, deduplicateUsersShare } from '@/lib/group-utils'

interface GroupViewSheetProps {
  group: GroupCreateDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERMISSION_OPTIONS: GroupPermission[] = [
  'READ' as GroupPermission,
  'GROUP_WRITE' as GroupPermission,
  'GROUP_WRITE_RECORDS' as GroupPermission,
]

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

  // Fetch live group data so changes (from mutations) are reflected immediately
  const { data: liveGroup } = useGetGroup(groupProp?.groupUUID ?? '', {
    enabled: open && !!groupProp?.groupUUID,
  })
  // Prefer live data; fall back to the prop
  const group = (liveGroup ?? groupProp) as GroupCreateDTO | null

  // Inline name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  // Add user state
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserUUID, setNewUserUUID] = useState('')
  const [newUserPermissions, setNewUserPermissions] = useState<
    GroupPermission[]
  >(['READ' as GroupPermission])
  const [addUserError, setAddUserError] = useState<string | null>(null)

  // Edit user permission state
  const [editingUserUUID, setEditingUserUUID] = useState<string | null>(null)
  const [pendingPermissions, setPendingPermissions] = useState<
    GroupPermission[]
  >([])

  const toggleNewUserPermission = (perm: GroupPermission) => {
    if (perm === ('READ' as GroupPermission)) return
    setNewUserPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const togglePendingPermission = (perm: GroupPermission) => {
    if (perm === ('READ' as GroupPermission)) return
    setPendingPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  // Deduplicate usersShare to avoid duplicate key errors and stale data
  const usersShare = useMemo(
    () => deduplicateUsersShare(group?.usersShare ?? []),
    [group?.usersShare]
  )

  // Early return after all hooks
  if (!group) return null

  const isPublic = !!group.publicShare

  // Check if current user is the owner (full access)
  const isOwner = userUUID === group.ownerUserUUID

  // If not owner, check usersShare for current user's permissions
  const currentUserShare = usersShare.find((u) => u.userUUID === userUUID)
  const currentUserPermissions = isOwner
    ? (['GROUP_WRITE', 'GROUP_WRITE_RECORDS'] as GroupPermission[])
    : (currentUserShare?.permissions ?? [])

  // Can edit group if owner or has GROUP_WRITE permission
  const canWrite = isOwner || canEditGroup(currentUserPermissions)

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

  const handleStartEditName = () => {
    setEditedName(group.name)
    setIsEditingName(true)
  }

  const handleAddUser = async () => {
    const trimmedUUID = newUserUUID.trim()
    if (!trimmedUUID) return

    setAddUserError(null)

    // Prevent adding the owner as a participant
    if (trimmedUUID === group.ownerUserUUID) {
      setAddUserError(t('groups.cannotAddOwner'))
      return
    }

    // Prevent adding duplicate user
    if (usersShare.some((u) => u.userUUID === trimmedUUID)) {
      setAddUserError(t('groups.userAlreadyExists'))
      return
    }

    const newShare: GroupShareToUserDTO = {
      userUUID: trimmedUUID,
      // Always include READ; merge with any extra permissions selected
      permissions: Array.from(
        new Set(['READ' as GroupPermission, ...newUserPermissions])
      ),
    }

    try {
      await updateGroup.mutateAsync({
        ...group,
        usersShare: [...usersShare, newShare],
      })
      setNewUserUUID('')
      setNewUserPermissions(['READ' as GroupPermission])
      setShowAddUser(false)
    } catch (error) {
      logger.error('Failed to add user to group', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleRemoveUser = async (targetUserUUID: string) => {
    try {
      await updateGroup.mutateAsync({
        ...group,
        usersShare: usersShare.filter((u) => u.userUUID !== targetUserUUID),
      })
    } catch (error) {
      logger.error('Failed to remove user from group', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleConfirmPermissionChange = async () => {
    if (!editingUserUUID || pendingPermissions.length === 0) return

    try {
      await updateGroup.mutateAsync({
        ...group,
        usersShare: usersShare.map((u) =>
          u.userUUID === editingUserUUID
            ? { ...u, permissions: pendingPermissions }
            : u
        ),
      })
      setEditingUserUUID(null)
      setPendingPermissions([])
    } catch (error) {
      logger.error('Failed to update user permission', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleCancelPermissionChange = () => {
    setEditingUserUUID(null)
    setPendingPermissions([])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="space-y-4 mb-4">
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
                        className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 border-gray-200"
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('groups.users')}
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {t('groups.info')}
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t('groups.sharedUsers')} ({usersShare.length})
              </h3>
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => {
                    setShowAddUser(!showAddUser)
                    setAddUserError(null)
                  }}
                  variant={showAddUser ? 'secondary' : 'default'}
                  className="h-7 text-xs"
                >
                  {showAddUser ? (
                    <>
                      <X className="h-3.5 w-3.5 mr-1" />
                      {t('common.cancel')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      {t('groups.addUser')}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Input
                    value={newUserUUID}
                    onChange={(e) => {
                      setNewUserUUID(e.target.value)
                      setAddUserError(null)
                    }}
                    placeholder={t('groups.userUuidPlaceholder')}
                    className="font-mono text-xs h-8 flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddUser}
                    disabled={!newUserUUID.trim() || updateGroup.isPending}
                    className="h-8"
                  >
                    {updateGroup.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label
                      key={perm}
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        perm === 'READ'
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      )}
                    >
                      <Checkbox
                        checked={
                          perm === 'READ'
                            ? true
                            : newUserPermissions.includes(perm)
                        }
                        onCheckedChange={
                          perm === 'READ'
                            ? undefined
                            : () => toggleNewUserPermission(perm)
                        }
                        disabled={perm === 'READ'}
                      />
                      {t(`groups.permissions.${perm}`)}
                    </label>
                  ))}
                </div>
                {addUserError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{addUserError}</span>
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="h-[400px] w-full">
              <div className="space-y-1 pr-4">
                {usersShare.length > 0 ? (
                  usersShare.map((user) => (
                    <div
                      key={user.userUUID}
                      className="flex items-center justify-between px-2 py-1.5 border rounded-md hover:bg-muted/50 group/user"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <code className="text-[11px] font-mono text-muted-foreground truncate">
                          {user.userUUID}
                        </code>
                        {user.userUUID && (
                          <CopyButton
                            text={user.userUUID}
                            label={t('groups.userUuid')}
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover/user:opacity-100 transition-opacity"
                            showToast={true}
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {editingUserUUID === user.userUUID ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              {PERMISSION_OPTIONS.map((perm) => (
                                <label
                                  key={perm}
                                  className={cn(
                                    'flex items-center gap-1 text-[10px]',
                                    perm === 'READ'
                                      ? 'cursor-not-allowed opacity-60'
                                      : 'cursor-pointer'
                                  )}
                                >
                                  <Checkbox
                                    checked={
                                      perm === 'READ'
                                        ? true
                                        : pendingPermissions.includes(perm)
                                    }
                                    onCheckedChange={
                                      perm === 'READ'
                                        ? undefined
                                        : () => togglePendingPermission(perm)
                                    }
                                    disabled={perm === 'READ'}
                                    className="h-3.5 w-3.5"
                                  />
                                  {t(`groups.permissions.${perm}`)}
                                </label>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                              onClick={handleConfirmPermissionChange}
                              disabled={
                                pendingPermissions.length === 0 ||
                                updateGroup.isPending
                              }
                            >
                              {updateGroup.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={handleCancelPermissionChange}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1">
                              {(user.permissions ?? []).map((perm) => (
                                <Badge
                                  key={perm}
                                  variant="secondary"
                                  className="text-[10px] h-5 px-1"
                                >
                                  {t(`groups.permissions.${perm}`)}
                                </Badge>
                              ))}
                            </div>
                            {canWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setEditingUserUUID(user.userUUID ?? null)
                                    setPendingPermissions(
                                      user.permissions ?? []
                                    )
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    user.userUUID &&
                                    handleRemoveUser(user.userUUID)
                                  }
                                  disabled={updateGroup.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('groups.noUsers')}</p>
                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAddUser(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('groups.addFirstUser')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('groups.info')}</h3>
              <div className="space-y-3">
                {/* Visibility */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{t('groups.visibility')}</div>
                    <div className="text-sm text-muted-foreground">
                      {isPublic
                        ? t('groups.publicDescription')
                        : t('groups.privateDescription')}
                    </div>
                  </div>
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
                </div>

                {/* Your Permissions */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {t('groups.yourPermissions')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isOwner
                        ? t('groups.ownerDescription')
                        : currentUserPermissions.length > 0
                          ? currentUserPermissions
                              .map((p) => t(`groups.permissions.${p}`))
                              .join(', ')
                          : t('groups.permissions.READ')}
                    </div>
                  </div>
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
                            className="text-[10px] h-5 px-1 bg-gray-100 text-gray-600 border-gray-200"
                          >
                            {t(`groups.permissions.${perm}`)}
                          </Badge>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <Separator />

                {/* Group UUID */}
                {group.groupUUID && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{t('groups.groupUuid')}</div>
                      <div className="text-sm text-muted-foreground font-mono truncate">
                        {group.groupUUID}
                      </div>
                    </div>
                    <CopyButton
                      text={group.groupUUID}
                      label={t('groups.groupUuid')}
                      size="sm"
                      variant="ghost"
                      showToast={true}
                      className="shrink-0"
                    />
                  </div>
                )}

                {/* Owner UUID */}
                {group.ownerUserUUID && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{t('groups.ownerUuid')}</div>
                      <div className="text-sm text-muted-foreground font-mono truncate">
                        {group.ownerUserUUID}
                      </div>
                    </div>
                    <CopyButton
                      text={group.ownerUserUUID}
                      label={t('groups.ownerUuid')}
                      size="sm"
                      variant="ghost"
                      showToast={true}
                      className="shrink-0"
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
