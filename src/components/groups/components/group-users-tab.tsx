'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type {
  GroupCreateDTO,
  GroupPermission,
  GroupShareToUserDTO,
  UserDTO,
} from 'iom-sdk'

import {
  Badge,
  Button,
  Checkbox,
  CopyButton,
  ScrollArea,
} from '@/components/ui'
import { cn } from '@/lib/utils'

import { UserIdentifierInput } from './user-identifier-input'

const PERMISSION_OPTIONS: GroupPermission[] = [
  'READ' as GroupPermission,
  'GROUP_WRITE' as GroupPermission,
  'GROUP_WRITE_RECORDS' as GroupPermission,
]

interface GroupUsersTabProps {
  group: GroupCreateDTO
  usersShare: GroupShareToUserDTO[]
  canWrite: boolean
  isPending: boolean
  onAddUser: (share: GroupShareToUserDTO) => Promise<void>
  onRemoveUser: (userUUID: string) => Promise<void>
  onUpdatePermissions: (
    userUUID: string,
    permissions: GroupPermission[]
  ) => Promise<void>
}

export function GroupUsersTab({
  group,
  usersShare,
  canWrite,
  isPending,
  onAddUser,
  onRemoveUser,
  onUpdatePermissions,
}: GroupUsersTabProps) {
  const t = useTranslations()

  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserPermissions, setNewUserPermissions] = useState<
    GroupPermission[]
  >(['READ' as GroupPermission])
  const [addUserError, setAddUserError] = useState<string | null>(null)

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

  const handleAddUser = async (user: UserDTO) => {
    setAddUserError(null)

    if (user.userUUID === group.ownerUserUUID) {
      setAddUserError(t('groups.cannotAddOwner'))
      return
    }
    if (usersShare.some((u) => u.userUUID === user.userUUID)) {
      setAddUserError(t('groups.userAlreadyExists'))
      return
    }

    const newShare: GroupShareToUserDTO = {
      userUUID: user.userUUID,
      permissions: Array.from(
        new Set(['READ' as GroupPermission, ...newUserPermissions])
      ),
    }

    await onAddUser(newShare)
    setNewUserPermissions(['READ' as GroupPermission])
    setShowAddUser(false)
  }

  const handleConfirmPermissionChange = async () => {
    if (!editingUserUUID || pendingPermissions.length === 0) return
    await onUpdatePermissions(editingUserUUID, pendingPermissions)
    setEditingUserUUID(null)
    setPendingPermissions([])
  }

  const handleCancelPermissionChange = () => {
    setEditingUserUUID(null)
    setPendingPermissions([])
  }

  return (
    <div className="space-y-3 flex-1 overflow-hidden mt-2 flex flex-col">
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

      {showAddUser && (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          <UserIdentifierInput onResolve={handleAddUser} disabled={isPending} />
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
                    perm === 'READ' ? true : newUserPermissions.includes(perm)
                  }
                  onCheckedChange={
                    perm === 'READ'
                      ? undefined
                      : () => toggleNewUserPermission(perm)
                  }
                  disabled={perm === 'READ' || isPending}
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

      <ScrollArea className="flex-1 h-[calc(100%-120px)]">
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
                              disabled={perm === 'READ' || isPending}
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
                        disabled={pendingPermissions.length === 0 || isPending}
                      >
                        {isPending ? (
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
                        disabled={isPending}
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
                              setPendingPermissions(user.permissions ?? [])
                            }}
                            disabled={isPending}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              user.userUUID && onRemoveUser(user.userUUID)
                            }
                            disabled={isPending}
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
                  disabled={isPending}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('groups.addFirstUser')}
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
