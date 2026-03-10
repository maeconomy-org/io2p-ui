'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import type { GroupPermission, GroupShareToUserDTO } from 'iom-sdk'

import { groupSchema, GroupFormValues } from '@/lib/validations'

const PERMISSION_OPTIONS: GroupPermission[] = [
  'READ' as GroupPermission,
  'GROUP_WRITE' as GroupPermission,
  'GROUP_WRITE_RECORDS' as GroupPermission,
]

interface UseGroupFormOptions {
  open: boolean
  defaultName?: string
  onClose?: () => void
}

interface UseGroupFormReturn {
  form: ReturnType<typeof useForm<GroupFormValues>>
  pendingUsers: GroupShareToUserDTO[]
  newUserUUID: string
  newUserPermissions: GroupPermission[]
  addUserError: string | null
  isPublic: boolean
  publicPermissions: GroupPermission[]
  permissionOptions: GroupPermission[]
  setNewUserUUID: (value: string) => void
  setAddUserError: (error: string | null) => void
  setIsPublic: (value: boolean) => void
  togglePermission: (perm: GroupPermission) => void
  togglePublicPermission: (perm: GroupPermission) => void
  handleAddPendingUser: () => void
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
  const { open, defaultName = '', onClose } = options
  const t = useTranslations()

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: defaultName,
    },
  })

  const [pendingUsers, setPendingUsers] = useState<GroupShareToUserDTO[]>([])
  const [newUserUUID, setNewUserUUID] = useState('')
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

  const handleAddPendingUser = useCallback(() => {
    const trimmedUUID = newUserUUID.trim()
    if (!trimmedUUID) return

    setAddUserError(null)

    if (pendingUsers.some((u) => u.userUUID === trimmedUUID)) {
      setAddUserError(t('groups.userAlreadyExists'))
      return
    }

    setPendingUsers((prev) => [
      ...prev,
      {
        userUUID: trimmedUUID,
        permissions: Array.from(
          new Set(['READ' as GroupPermission, ...newUserPermissions])
        ),
      },
    ])
    setNewUserUUID('')
    setNewUserPermissions(['READ' as GroupPermission])
  }, [newUserUUID, newUserPermissions, pendingUsers, t])

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
    setNewUserUUID('')
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
      setNewUserUUID('')
      setNewUserPermissions(['READ' as GroupPermission])
      setAddUserError(null)
      setIsPublicRaw(false)
      setPublicPermissions(['READ' as GroupPermission])
    }
  }, [open, defaultName, form])

  return {
    form,
    pendingUsers,
    newUserUUID,
    newUserPermissions,
    addUserError,
    isPublic,
    publicPermissions,
    permissionOptions: PERMISSION_OPTIONS,
    setNewUserUUID,
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
