'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save,
  X,
  Loader2,
  UserPlus,
  Plus,
  Trash2,
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
  Input,
  Badge,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ScrollArea,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useGroups } from '@/hooks/api'
import { groupSchema, GroupFormValues } from '@/lib/validations'

const PERMISSION_OPTIONS: GroupPermission[] = [
  'READ' as GroupPermission,
  'GROUP_WRITE' as GroupPermission,
  'GROUP_WRITE_RECORDS' as GroupPermission,
]

interface GroupCreateSheetProps {
  group: GroupCreateDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GroupCreateSheet({
  group,
  open,
  onOpenChange,
}: GroupCreateSheetProps) {
  const t = useTranslations()
  const { useCreateGroup } = useGroups()
  const createGroup = useCreateGroup()

  // Users to add (collected before submission)
  const [pendingUsers, setPendingUsers] = useState<GroupShareToUserDTO[]>([])
  const [newUserUUID, setNewUserUUID] = useState('')
  const [newUserPermissions, setNewUserPermissions] = useState<
    GroupPermission[]
  >(['READ' as GroupPermission])
  const [addUserError, setAddUserError] = useState<string | null>(null)

  const togglePermission = (perm: GroupPermission) => {
    if (perm === ('READ' as GroupPermission)) return
    setNewUserPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
    },
  })

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (open) {
      form.reset({ name: group?.name ?? '' })
      setPendingUsers([])
      setNewUserUUID('')
      setNewUserPermissions(['READ' as GroupPermission])
      setAddUserError(null)
    }
  }, [group, open, form])

  const handleAddPendingUser = () => {
    const trimmedUUID = newUserUUID.trim()
    if (!trimmedUUID) return

    setAddUserError(null)

    // Check for duplicates
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
  }

  const handleRemovePendingUser = (userUUID: string) => {
    setPendingUsers((prev) => prev.filter((u) => u.userUUID !== userUUID))
  }

  const onSubmit = async (data: GroupFormValues) => {
    try {
      const dto: GroupCreateDTO = {
        name: data.name,
        ...(group?.groupUUID ? { groupUUID: group.groupUUID } : {}),
        ...(pendingUsers.length > 0 ? { usersShare: pendingUsers } : {}),
      }

      await createGroup.mutateAsync(dto)

      logger.info('Group created', { name: data.name })

      onOpenChange(false)
      form.reset()
      setPendingUsers([])
    } catch (error) {
      logger.error('Error saving group:', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleCancel = () => {
    form.reset()
    setPendingUsers([])
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t('groups.form.createTitle')}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Group Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('groups.form.name')} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('groups.form.namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Add Users Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {t('groups.form.addUsers')}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({t('groups.form.addUsersOptional')})
                </span>
              </div>

              {/* Add User Input Row */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={newUserUUID}
                    onChange={(e) => {
                      setNewUserUUID(e.target.value)
                      setAddUserError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddPendingUser()
                      }
                    }}
                    placeholder={t('groups.userUuidPlaceholder')}
                    className="font-mono text-xs h-8 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddPendingUser}
                    disabled={!newUserUUID.trim()}
                    className="h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
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
                            : () => togglePermission(perm)
                        }
                        disabled={perm === 'READ'}
                      />
                      {t(`groups.permissions.${perm}`)}
                    </label>
                  ))}
                </div>
              </div>
              {addUserError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{addUserError}</span>
                </div>
              )}

              {/* Pending Users List */}
              {pendingUsers.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {pendingUsers.map((user, index) => (
                      <div
                        key={user.userUUID ?? index}
                        className="flex items-center justify-between px-2 py-1.5 border rounded-md bg-muted/30"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <code className="text-[11px] font-mono text-muted-foreground truncate">
                            {user.userUUID}
                          </code>
                          <div className="flex items-center gap-1 shrink-0">
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
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                          onClick={() =>
                            user.userUUID &&
                            handleRemovePendingUser(user.userUUID)
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={createGroup.isPending}
                className="flex-1"
              >
                {createGroup.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {createGroup.isPending
                  ? t('groups.form.creating')
                  : t('groups.form.createGroup')}
                {pendingUsers.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 text-[11px]"
                  >
                    +{pendingUsers.length}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={createGroup.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
