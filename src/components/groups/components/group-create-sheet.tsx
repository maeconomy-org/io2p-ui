'use client'

import {
  Save,
  X,
  Loader2,
  UserPlus,
  Plus,
  Trash2,
  AlertCircle,
  Globe,
  Lock,
  HelpCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GroupCreateDTO } from 'iom-sdk'

import {
  Button,
  Input,
  Badge,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  ScrollArea,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Switch,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { logger } from '@/lib'
import { useGroups } from '@/hooks/api'
import { useAuth } from '@/contexts'
import { useGroupForm } from '../hooks'

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
  const { userUUID } = useAuth()

  const {
    form,
    pendingUsers,
    newUserUUID,
    newUserPermissions,
    addUserError,
    isPublic,
    publicPermissions,
    permissionOptions,
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
  } = useGroupForm({
    open,
    defaultName: group?.name ?? '',
    ownerUserUUID: userUUID,
  })

  const onSubmit = async (data: any) => {
    try {
      const dto = buildGroupDTO(data, group?.groupUUID)
      await createGroup.mutateAsync(dto)
      logger.info('Group created', { name: data.name })
      onOpenChange(false)
      resetForm()
    } catch (error) {
      logger.error('Error saving group:', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl gap-0 flex flex-col overflow-hidden">
        <SheetHeader className="pb-3 border-b flex-shrink-0">
          <SheetTitle>{t('groups.form.createTitle')}</SheetTitle>
          <SheetDescription>
            {t('groups.form.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Form {...form}>
              <form className="space-y-4 py-3 px-1">
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

                {/* Public/Private Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FormLabel className="!mt-0">
                        {t('groups.visibility')}
                      </FormLabel>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 cursor-help"
                            type="button"
                          >
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              {t('groups.public')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('groups.publicDescription')}
                            </p>
                            <p className="text-sm font-medium mt-2">
                              {t('groups.private')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('groups.privateDescription')}
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1',
                        isPublic
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      )}
                    >
                      {isPublic ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {isPublic ? t('groups.public') : t('groups.private')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {t('groups.form.isPublic')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isPublic
                          ? t('groups.publicShortDescription')
                          : t('groups.privateShortDescription')}
                      </div>
                    </div>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  </div>
                </div>

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
                          clearUserError()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddPendingUser()
                          }
                        }}
                        placeholder={t('groups.userUuidPlaceholder')}
                        className="font-mono text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddPendingUser}
                        disabled={!newUserUUID.trim()}
                        className="px-3"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      {permissionOptions.map((perm) => (
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
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <span className="border-b border-dotted border-muted-foreground cursor-help">
                                {t(`groups.permissions.${perm}`)}
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64">
                              <p className="text-xs text-muted-foreground">
                                {t(`groups.permissionDescription.${perm}`)}
                              </p>
                            </HoverCardContent>
                          </HoverCard>
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
              </form>
            </Form>
          </ScrollArea>
        </div>

        {/* Fixed Actions at Bottom */}
        <div className="flex-shrink-0 pt-4 border-t mt-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
