'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import type { GroupPermission, GroupShareToUserDTO, UserDTO } from 'iom-sdk'

import { groupSchema, GroupFormValues } from '@/lib/validations'

const PERMISSION_OPTIONS: GroupPermission[] = [
  'READ' as GroupPermission,
  'GROUP_WRITE' as GroupPermission,
  'GROUP_WRITE_RECORDS' as GroupPermission,
]

interface UseGroupFormOptions {
  open: boolean
  defaultName?: string
  ownerUserUUID?: string
  onClose?: () => void
}

interface UseGroupFormReturn {
  form: ReturnType<typeof useForm<GroupFormValues>>
  pendingUsers: GroupShareToUserDTO[]
  newUserPermissions: GroupPermission[]
  addUserError: string | null
  isPublic: boolean
  publicPermissions: GroupPermission[]
  permissionOptions: GroupPermission[]
  setAddUserError: (error: string | null) => void
  setIsPublic: (value: boolean) => void
  togglePermission: (perm: GroupPermission) => void
  togglePublicPermission: (perm: GroupPermission) => void
  handleAddPendingUser: (user: UserDTO) => void
  handleRemovePendingUser: (userUUID: string) => void
  buildGroupDTO: (
    data: GroupFormValues,
    groupUUID?: string
  ) => {
    name: string
    groupUUID?: string
    usersShare?: GroupShareToUserDTO[]
    publicShare?: { permissions: GroupPermission[] }
  }
  resetForm: () => void
  clearUserError: () => void
}

export function useGroupForm(options: UseGroupFormOptions): UseGroupFormReturn {
  const { open, defaultName = '', ownerUserUUID } = options
  const t = useTranslations()

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: defaultName,
    },
  })

  const [pendingUsers, setPendingUsers] = useState<GroupShareToUserDTO[]>([])
  const [newUserPermissions, setNewUserPermissions] = useState<
    GroupPermission[]
  >(['READ' as GroupPermission])
  const [addUserError, setAddUserError] = useState<string | null>(null)
  const [isPublic, setIsPublicRaw] = useState(false)
  const [publicPermissions, setPublicPermissions] = useState<GroupPermission[]>(
    ['READ' as GroupPermission]
  )

  // When toggling to public, force permissions to READ-only
  const setIsPublic = useCallback((value: boolean) => {
    setIsPublicRaw(value)
    if (value) {
      setPublicPermissions(['READ' as GroupPermission])
    }
  }, [])

  const togglePermission = useCallback(
    (perm: GroupPermission) => {
      if (perm === ('READ' as GroupPermission)) return
      setNewUserPermissions((prev) =>
        prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
      )
    },
    [setNewUserPermissions]
  )

  const togglePublicPermission = useCallback(
    (perm: GroupPermission) => {
      if (perm === ('READ' as GroupPermission)) return
      setPublicPermissions((prev) =>
        prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
      )
    },
    [setPublicPermissions]
  )

  const handleAddPendingUser = useCallback(
    (user: UserDTO) => {
      setAddUserError(null)

      if (ownerUserUUID && user.userUUID === ownerUserUUID) {
        setAddUserError(t('groups.cannotAddOwner'))
        return
      }

      if (pendingUsers.some((u) => u.userUUID === user.userUUID)) {
        setAddUserError(t('groups.userAlreadyExists'))
        return
      }

      setPendingUsers((prev) => [
        ...prev,
        {
          userUUID: user.userUUID,
          permissions: Array.from(
            new Set(['READ' as GroupPermission, ...newUserPermissions])
          ),
        },
      ])
      setNewUserPermissions(['READ' as GroupPermission])
    },
    [newUserPermissions, pendingUsers, ownerUserUUID, t]
  )

  const handleRemovePendingUser = useCallback((userUUID: string) => {
    setPendingUsers((prev) => prev.filter((u) => u.userUUID !== userUUID))
  }, [])

  const buildGroupDTO = useCallback(
    (data: GroupFormValues, groupUUID?: string) => {
      return {
        name: data.name,
        ...(groupUUID ? { groupUUID } : {}),
        ...(pendingUsers.length > 0 ? { usersShare: pendingUsers } : {}),
        publicShare: isPublic ? { permissions: publicPermissions } : undefined,
      }
    },
    [pendingUsers, isPublic, publicPermissions]
  )

  const resetForm = useCallback(() => {
    form.reset({ name: '' })
    setPendingUsers([])
    setNewUserPermissions(['READ' as GroupPermission])
    setAddUserError(null)
    setIsPublicRaw(false)
    setPublicPermissions(['READ' as GroupPermission])
  }, [form])

  const clearUserError = useCallback(() => {
    setAddUserError(null)
  }, [])

  useEffect(() => {
    if (open) {
      form.reset({ name: defaultName })
      setPendingUsers([])
      setNewUserPermissions(['READ' as GroupPermission])
      setAddUserError(null)
      setIsPublicRaw(false)
      setPublicPermissions(['READ' as GroupPermission])
    }
  }, [open, defaultName, form])

  return {
    form,
    pendingUsers,
    newUserPermissions,
    addUserError,
    isPublic,
    publicPermissions,
    permissionOptions: PERMISSION_OPTIONS,
    setAddUserError,
    setIsPublic,
    togglePermission,
    togglePublicPermission,
    handleAddPendingUser,
    handleRemovePendingUser,
    buildGroupDTO,
    resetForm,
    clearUserError,
  }
}
