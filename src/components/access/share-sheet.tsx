'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Globe, Loader2, UserPlus, X } from 'lucide-react'
import type { GrantDTO } from 'io2p-client'

import {
  Badge,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { useAuth } from '@/contexts'
import { useGrants } from '@/hooks/api/access'
import { useUserDirectory } from '@/hooks/api/users'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'

import { PermissionSelect, type Permission } from './permission-select'

/**
 * What a Share sheet can be opened on.
 *
 * Objects and processes ONLY, and the limit comes from the READ side rather than the write one:
 * `grant`/`revoke` accept formulas, constants and templates too (read-share, D-C3), but
 * `GET /v1/access` — who-can-access — is typed `object | process`. Offering the sheet on a formula
 * would let someone grant access they could then neither see nor revoke from that formula. Widen
 * this the day the who-can-access query widens.
 */
export type ShareResourceType = 'object' | 'process'

export interface ShareTarget {
  type: ShareResourceType
  id: string
  name: string
}

/**
 * Cascade is an ancestor walk at check time, so it only means anything for something with
 * descendants. The node rejects it for processes, and the library resources have no hierarchy.
 */
function canCascade(type: ShareResourceType) {
  return type === 'object'
}

const PUBLIC_ROW_KEY = 'public'

function subjectKey(grant: GrantDTO) {
  return grant.subject.kind === 'public' ? PUBLIC_ROW_KEY : grant.subject.userId
}

/**
 * Who can see one entity, and at what level.
 *
 * Grants are the primitive: one resource × one subject × one permission. Because `grant` UPSERTS on
 * (resource, subject), adding somebody and changing their level are the same call — the sheet never
 * has to know which it is doing.
 *
 * `includeDescendants` sits on each ROW rather than on the sheet, because the grant carries it per
 * subject: one person can hold the whole subtree while another holds only this object. (A Share
 * bundle cannot do that — its cascade is one flag for the bundle.)
 */
export function ShareSheet({
  open,
  onOpenChange,
  target,
  isOwner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ShareTarget
  /** Only an owner/admin may read the grant list; the node 403s everyone else. */
  isOwner: boolean
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  const [pickerOpen, setPickerOpen] = useState(false)

  const { useList, useGrant, useRevoke } = useGrants()
  const resource = useMemo(
    () => ({ resourceType: target.type, resourceId: target.id }),
    [target.type, target.id]
  )
  const { data: grantsPage, isLoading } = useList(resource, undefined, {
    enabled: open && isOwner,
  })
  const grantMutation = useGrant()
  const revokeMutation = useRevoke()

  const { users, nameOf } = useUserDirectory({ enabled: open && isOwner })

  const grants = grantsPage?.data ?? []
  const granted = new Set(grants.map(subjectKey))
  const publicGrant = grants.find((g) => g.subject.kind === 'public')
  const userGrants = grants.filter((g) => g.subject.kind === 'user')

  // You cannot grant to yourself, and anyone already granted belongs in the list above, not the
  // picker — a picker offering a name that is already on screen reads as a duplicate.
  const candidates = users.filter((u) => u.id !== userId && !granted.has(u.id))

  const cascade = canCascade(target.type)

  const write = async (
    body: Parameters<typeof grantMutation.mutateAsync>[0]['body'],
    successKey: string
  ) => {
    try {
      await grantMutation.mutateAsync({ body })
      toast.success(t(successKey))
    } catch (error) {
      logger.error('Grant failed', error)
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  const grantTo = (
    subject: GrantDTO['subject'],
    permission: Permission,
    includeDescendants = false
  ) =>
    write(
      {
        resource: { type: target.type, id: target.id },
        subject,
        permission,
        ...(cascade ? { includeDescendants } : {}),
      },
      'access.granted'
    )

  const revoke = async (subject: GrantDTO['subject']) => {
    try {
      await revokeMutation.mutateAsync({
        body: { resource: { type: target.type, id: target.id }, subject },
      })
      toast.success(t('access.revoked'))
    } catch (error) {
      logger.error('Revoke failed', error)
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="truncate">
            {t('access.shareTitle', { name: target.name })}
          </SheetTitle>
          <SheetDescription>{t('access.shareDescription')}</SheetDescription>
        </SheetHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          {!isOwner && (
            <p className="text-sm text-muted-foreground">
              {t('access.ownerOnly')}
            </p>
          )}

          {isOwner && isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}

          {isOwner && !isLoading && (
            <>
              <div className="space-y-2">
                <Label>{t('access.peopleWithAccess')}</Label>

                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="truncate text-sm">{t('common.me')}</span>
                  <Badge variant="secondary" className="h-5">
                    {t('access.owner')}
                  </Badge>
                </div>

                {userGrants.map((grant) => {
                  const uid =
                    grant.subject.kind === 'user' ? grant.subject.userId : ''
                  return (
                    <div
                      key={grant.id}
                      className="space-y-2 rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm">
                          {nameOf(uid)}
                        </span>
                        <PermissionSelect
                          value={grant.permission as Permission}
                          disabled={grantMutation.isPending}
                          aria-label={t('access.permissionFor', {
                            name: nameOf(uid),
                          })}
                          onChange={(permission) =>
                            grantTo(
                              grant.subject,
                              permission,
                              grant.includeDescendants
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={t('access.revokeFor', {
                            name: nameOf(uid),
                          })}
                          onClick={() => revoke(grant.subject)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {cascade && (
                        <label className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={grant.includeDescendants}
                            onCheckedChange={(checked) =>
                              grantTo(
                                grant.subject,
                                grant.permission as Permission,
                                checked === true
                              )
                            }
                          />
                          <span>{t('access.includeDescendantsHint')}</span>
                        </label>
                      )}
                    </div>
                  )
                })}

                {userGrants.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('access.notShared')}
                  </p>
                )}
              </div>

              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('access.addPeople')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[18rem] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('access.searchPeople')} />
                    <CommandList>
                      <CommandEmpty>{t('access.noPeople')}</CommandEmpty>
                      <CommandGroup>
                        {candidates.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.displayName ?? ''} ${user.email ?? ''}`}
                            className="cursor-pointer"
                            onSelect={() => {
                              setPickerOpen(false)
                              grantTo({ kind: 'user', userId: user.id }, 'read')
                            }}
                          >
                            <span className="truncate">
                              {user.displayName || user.email || user.id}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="space-y-2 border-t pt-4">
                <Label>{t('access.publicLabel')}</Label>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={!!publicGrant}
                    onCheckedChange={(checked) =>
                      checked === true
                        ? grantTo({ kind: 'public' }, 'read')
                        : revoke({ kind: 'public' })
                    }
                  />
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('access.publicHint')}
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('common.done')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
