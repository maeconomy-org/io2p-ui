'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Globe, Info, Loader2, UserPlus, X } from 'lucide-react'
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
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '@/components/ui'
import { useAuth } from '@/contexts'
import { useGrants } from '@/hooks/api/access'
import { useUserDirectory, useUserSearch } from '@/hooks/api/users'
import { UnsavedBar } from '@/components/entity-sheet/sheet-lifecycle-footer'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'

import { PermissionSelect, type Permission } from './permission-select'

/**
 * What a Share sheet can be opened on.
 *
 * Objects and processes ONLY, and the limit comes from the READ side rather than the write one:
 * `grant`/`revoke` accept formulas, constants and templates too (read-share, C3), but
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
 * descendants. The node rejects it for processes.
 */
function canCascade(type: ShareResourceType) {
  return type === 'object'
}

const PUBLIC_KEY = 'public'

/** One staged row. `subject` is kept whole so the write does not have to rebuild it. */
interface DraftMember {
  subject: GrantDTO['subject']
  permission: Permission
  includeDescendants: boolean
}

type Draft = Record<string, DraftMember>

function keyOf(subject: GrantDTO['subject']) {
  return subject.kind === 'public' ? PUBLIC_KEY : subject.userId
}

function draftFromGrants(grants: GrantDTO[]): Draft {
  const draft: Draft = {}
  for (const grant of grants) {
    draft[keyOf(grant.subject)] = {
      subject: grant.subject,
      permission: grant.permission as Permission,
      includeDescendants: !!grant.includeDescendants,
    }
  }
  return draft
}

function sameMember(a: DraftMember, b: DraftMember) {
  return (
    a.permission === b.permission &&
    a.includeDescendants === b.includeDescendants
  )
}

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

  const { useList } = useGrants()
  const resource = useMemo(
    () => ({ resourceType: target.type, resourceId: target.id }),
    [target.type, target.id]
  )
  const { data: grantsPage, isLoading } = useList(resource, undefined, {
    enabled: open && isOwner,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Chrome matches `entity-sheet-shell`: same width, same `gap-0 p-0`, same bordered header
          and footer. A sheet that sits beside the detail sheet should not look like a different
          product. */}
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <span className="min-w-0 truncate">
              {t('access.shareTitle', { name: target.name })}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('access.shareDescription')}
          </SheetDescription>
        </SheetHeader>

        {!isOwner && (
          <p className="flex-1 px-6 py-4 text-sm text-muted-foreground">
            {t('access.ownerOnly')}
          </p>
        )}

        {isOwner && isLoading && (
          <div className="flex-1 space-y-3 px-6 py-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}

        {/* Mounted only once the grants are in, so the draft is seeded from them AT MOUNT rather
            than synced by an effect — which the compiler lint rejects, and which would let a
            background refetch quietly overwrite edits in progress. */}
        {isOwner && !isLoading && (
          <ShareForm
            target={target}
            grants={grantsPage?.data ?? []}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Who can see one entity, and at what level — staged, then written on Save.
 *
 * NOTHING is sent while you edit. Adding a person, changing a rung and ticking cascade all mutate a
 * local draft; Save diffs it against what the server had and issues only the calls that differ.
 * Granting the moment a name is picked means a mis-click IS already someone's access, undoable only
 * by a second write — and it made the sheet fire a request per keystroke-level interaction.
 *
 * `includeDescendants` sits on each MEMBER ROW because the grant carries it per subject: one person
 * can hold the whole subtree while another holds only this object.
 */
function ShareForm({
  target,
  grants,
  onDone,
}: {
  target: ShareTarget
  grants: GrantDTO[]
  onDone: () => void
}) {
  const t = useTranslations()
  const { userId } = useAuth()

  const initial = useMemo(() => draftFromGrants(grants), [grants])
  const [draft, setDraft] = useState<Draft>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const { useGrant, useRevoke } = useGrants()
  const grantMutation = useGrant()
  const revokeMutation = useRevoke()

  const memberIds = Object.keys(draft).filter((key) => key !== PUBLIC_KEY)

  // Names for staged rows come from the cached directory — and only when there is a row to name.
  // CANDIDATES come from a server search, so the picker can reach a user no directory page held.
  const { nameOf } = useUserDirectory({ enabled: memberIds.length > 0 })
  const { users, isFetching: searching } = useUserSearch(peopleQuery, {
    enabled: pickerOpen,
  })

  const cascade = canCascade(target.type)
  const publicMember = draft[PUBLIC_KEY]

  const setMember = (key: string, patch: Partial<DraftMember>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }))

  const removeMember = (key: string) =>
    setDraft((d) => {
      const next = { ...d }
      delete next[key]
      return next
    })

  const changed = Object.entries(draft).filter(
    ([key, member]) => !initial[key] || !sameMember(initial[key], member)
  )
  const removed = Object.keys(initial).filter((key) => !draft[key])
  const dirty = changed.length > 0 || removed.length > 0

  const candidates = users.filter((u) => u.id !== userId && !draft[u.id])

  const save = async () => {
    setSaving(true)
    try {
      // `grant` upserts on (resource, subject), so an added member and a changed rung are the same
      // call — the diff only has to say WHICH subjects differ, not how.
      for (const [, member] of changed) {
        await grantMutation.mutateAsync({
          body: {
            resource: { type: target.type, id: target.id },
            subject: member.subject,
            permission: member.permission,
            ...(cascade
              ? { includeDescendants: member.includeDescendants }
              : {}),
          },
        })
      }
      for (const key of removed) {
        await revokeMutation.mutateAsync({
          body: {
            resource: { type: target.type, id: target.id },
            subject: initial[key].subject,
          },
        })
      }
      toast.success(t('access.saved'))
      onDone()
    } catch (error) {
      logger.error('Save access failed', error)
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SheetBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('access.shareDescription')}
        </p>

        <div className="space-y-2">
          <Label>{t('access.peopleWithAccess')}</Label>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="truncate text-sm">{t('common.me')}</span>
            <Badge variant="secondary" className="h-5">
              {t('access.owner')}
            </Badge>
          </div>

          {memberIds.map((id) => (
            <div key={id} className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {nameOf(id)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('access.revokeFor', { name: nameOf(id) })}
                  onClick={() => removeMember(id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <PermissionSelect
                className="w-full"
                value={draft[id].permission}
                aria-label={t('access.permissionFor', { name: nameOf(id) })}
                onChange={(permission) => setMember(id, { permission })}
              />

              {/* Public already grants read to everyone signed in, so a personal READ grant adds
                  nothing WHILE it is on. It is not useless though — it survives general access
                  being switched off — so this informs rather than blocks or silently drops it. */}
              {!!publicMember && draft[id].permission === 'read' && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t('access.redundantRead')}</span>
                </p>
              )}

              {cascade && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={draft[id].includeDescendants}
                    onCheckedChange={(checked) =>
                      setMember(id, { includeDescendants: checked === true })
                    }
                  />
                  <span>{t('access.includeDescendantsHint')}</span>
                </label>
              )}
            </div>
          ))}

          {memberIds.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('access.notShared')}
            </p>
          )}
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              {t('access.addPeople')}
            </Button>
          </PopoverTrigger>
          {/* Match the trigger, so the list of names is as wide as the control that opened it
              rather than a fixed box that truncates every email. */}
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            {/* `shouldFilter={false}` — the server already filtered; letting cmdk filter the result
                again would hide rows it matched on a field cmdk cannot see. */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t('access.searchPeople')}
                value={peopleQuery}
                onValueChange={setPeopleQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {searching ? t('common.loading') : t('access.noPeople')}
                </CommandEmpty>
                <CommandGroup>
                  {candidates.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      className="cursor-pointer"
                      onSelect={() => {
                        setPickerOpen(false)
                        setPeopleQuery('')
                        setDraft((d) => ({
                          ...d,
                          [user.id]: {
                            subject: { kind: 'user', userId: user.id },
                            permission: 'read',
                            includeDescendants: false,
                          },
                        }))
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {user.displayName || user.email || user.id}
                        </span>
                        {user.displayName && user.email && (
                          <span className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        )}
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
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={!!publicMember}
              onCheckedChange={(checked) =>
                checked === true
                  ? setDraft((d) => ({
                      ...d,
                      [PUBLIC_KEY]: {
                        subject: { kind: 'public' },
                        permission: 'read',
                        includeDescendants: false,
                      },
                    }))
                  : removeMember(PUBLIC_KEY)
              }
            />
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {t('access.publicHint')}
            </span>
          </label>
        </div>
      </SheetBody>

      {dirty && <UnsavedBar count={changed.length + removed.length} />}

      <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onDone}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </SheetFooter>
    </>
  )
}
