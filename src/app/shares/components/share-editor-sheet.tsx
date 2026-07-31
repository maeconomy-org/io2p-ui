'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Info, Loader2, UserPlus, X } from 'lucide-react'
import type { ShareDTO } from 'io2p-client'

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
  Input,
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
} from '@/components/ui'
import { PermissionSelect, type Permission } from '@/components/access'
import { UnsavedBar } from '@/components/entity-sheet/sheet-lifecycle-footer'
import { useAuth } from '@/contexts'
import { useShares } from '@/hooks/api/access'
import { useUserDirectory, useUserSearch } from '@/hooks/api/users'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/logger'

import { ResourcePicker, type ShareResource } from './resource-picker'

export type ShareEditorMode = 'create' | 'edit' | 'duplicate'

interface Member {
  userId: string
  permission: Permission
}

/**
 * Create, edit or duplicate a Share.
 *
 * Two write shapes for one form: `POST` sends the WHOLE bundle, `PATCH` sends **deltas**
 * (`resources:{add,remove}`, `members:{add,update,remove}`). So an edit diffs against what loaded,
 * with the same symmetry the entity Share sheet needs — a diff that sends additions but drops
 * removals reports success while leaving people's access exactly where it was.
 *
 * Note the API's own asymmetry: `resources.remove` takes `{type,id}` objects, `members.remove` takes
 * bare userId strings.
 */
export function ShareEditorSheet({
  open,
  onOpenChange,
  mode,
  share,
  seedResources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ShareEditorMode
  /** The subject for `edit` and `duplicate`. */
  share?: ShareDTO | null
  /** Pre-filled contents — a bulk selection becoming a bundle, which is what a Share IS. */
  seedResources?: ShareResource[]
}) {
  const t = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <span className="min-w-0 truncate">
              {mode === 'edit'
                ? (share?.name ?? t('shares.title'))
                : mode === 'duplicate'
                  ? t('shares.duplicateTitle')
                  : t('shares.create')}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('shares.editorDescription')}
          </SheetDescription>
        </SheetHeader>

        {/* Fresh per open, so the draft seeds from the row at mount rather than through an effect. */}
        {open && (
          <ShareForm
            mode={mode}
            share={share ?? null}
            seedResources={seedResources}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ShareForm({
  mode,
  share,
  seedResources,
  onDone,
}: {
  mode: ShareEditorMode
  share: ShareDTO | null
  seedResources?: ShareResource[]
  onDone: () => void
}) {
  const t = useTranslations()
  const { userId } = useAuth()

  // A duplicate starts from the original's contents but is a CREATE — which is what makes it the
  // answer to "restore my deleted share": the create path re-validates every resource still exists
  // and is still shareable, instead of resurrecting grants against a world that moved on.
  const seed = mode === 'create' ? null : share

  const [name, setName] = useState(
    seed
      ? mode === 'duplicate'
        ? t('shares.copyOf', { name: seed.name })
        : seed.name
      : ''
  )
  const [resources, setResources] = useState<ShareResource[]>(
    seedResources?.length
      ? seedResources
      : (seed?.resources ?? []).map((r) => ({
          type: r.type,
          id: r.id,
          name: r.name ?? '',
        }))
  )
  const [members, setMembers] = useState<Member[]>(
    (seed?.members ?? []).map((m) => ({
      userId: m.userId,
      permission: m.permission as Permission,
    }))
  )
  const [cascade, setCascade] = useState(!!seed?.includeDescendants)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const { useCreate, useUpdate } = useShares()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  const { nameOf } = useUserDirectory({ enabled: members.length > 0 })
  const { users, isFetching: searching } = useUserSearch(peopleQuery, {
    enabled: pickerOpen,
  })

  // Cascade is an ancestor walk, and a process has no descendants — the node REJECTS the flag if any
  // resource is a process. Clearing it here turns a 400 three steps later into a visible rule.
  const hasProcess = resources.some((r) => r.type === 'process')
  const cascadeAllowed = !hasProcess
  const effectiveCascade = cascadeAllowed && cascade

  const memberIds = new Set(members.map((m) => m.userId))
  const candidates = users.filter(
    (u) => u.id !== userId && !memberIds.has(u.id)
  )

  // `POST /shares` requires ≥1 resource AND ≥1 member — unlike every other create here, where a name
  // is enough and you fill the rest in later. Blocking Save with the reason shown beats a draft that
  // only exists in this tab.
  const complete = !!name.trim() && resources.length > 0 && members.length > 0

  // DIRTY IS THE DELTA, not the size of the bundle. Counting resources + members made an untouched
  // share open claiming "2 unsaved changes" — the bar has to answer "what did I change", and on a
  // create everything is a change while on an edit nothing is until you move something.
  const delta =
    mode === 'edit' && share
      ? buildDelta(share, {
          name: name.trim(),
          resources,
          members,
          cascade: effectiveCascade,
        })
      : null
  const changeCount = delta
    ? Object.keys(delta).length
    : resources.length + members.length
  const dirty = mode !== 'edit' || Object.keys(delta ?? {}).length > 0

  const save = async () => {
    setSaving(true)
    try {
      if (mode === 'edit' && share) {
        await updateMutation.mutateAsync({
          id: share.id,
          body: buildDelta(share, {
            name: name.trim(),
            resources,
            members,
            cascade: effectiveCascade,
          }),
        })
      } else {
        await createMutation.mutateAsync({
          body: {
            name: name.trim(),
            resources: resources.map((r) => ({ type: r.type, id: r.id })),
            members,
            ...(effectiveCascade ? { includeDescendants: true } : {}),
          },
        })
      }
      toast.success(t(mode === 'edit' ? 'shares.saved' : 'shares.created'))
      onDone()
    } catch (error) {
      logger.error('Save share failed', error)
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SheetBody className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="share-name">{t('shares.fields.name')}</Label>
          <Input
            id="share-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('shares.namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('shares.fields.resources')}</Label>
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <Badge variant="outline" className="h-5 shrink-0">
                {t(`shares.resourceType.${resource.type}`)}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {resource.name || (
                  <span className="font-mono text-xs text-muted-foreground">
                    {resource.id}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={t('shares.removeResource', {
                  name: resource.name || resource.id,
                })}
                onClick={() =>
                  setResources((rs) => rs.filter((r) => r.id !== resource.id))
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {resources.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('shares.noResourcesYet')}
            </p>
          )}
          <ResourcePicker
            selectedIds={new Set(resources.map((r) => r.id))}
            onAdd={(resource) => setResources((rs) => [...rs, resource])}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('shares.fields.members')}</Label>
          {members.map((member) => (
            <div
              key={member.userId}
              className="space-y-2 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {nameOf(member.userId)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('shares.removeMember', {
                    name: nameOf(member.userId),
                  })}
                  onClick={() =>
                    setMembers((ms) =>
                      ms.filter((m) => m.userId !== member.userId)
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <PermissionSelect
                className="w-full"
                value={member.permission}
                aria-label={t('access.permissionFor', {
                  name: nameOf(member.userId),
                })}
                onChange={(permission) =>
                  setMembers((ms) =>
                    ms.map((m) =>
                      m.userId === member.userId ? { ...m, permission } : m
                    )
                  )
                }
              />
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('shares.noMembersYet')}
            </p>
          )}

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                {t('access.addPeople')}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
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
                          setMembers((ms) => [
                            ...ms,
                            { userId: user.id, permission: 'read' },
                          ])
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
        </div>

        <div className="space-y-2 border-t pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={effectiveCascade}
              disabled={!cascadeAllowed}
              onCheckedChange={(checked) => setCascade(checked === true)}
            />
            <span>{t('shares.cascadeLabel')}</span>
          </label>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {cascadeAllowed
                ? t('shares.cascadeHint')
                : t('shares.cascadeBlockedByProcess')}
            </span>
          </p>
        </div>

        {!complete && (
          <p className="text-xs text-muted-foreground">
            {t('shares.incompleteHint')}
          </p>
        )}
      </SheetBody>

      {complete && dirty && <UnsavedBar count={changeCount} />}

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
          disabled={!complete || !dirty || saving}
          onClick={save}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </SheetFooter>
    </>
  )
}

/**
 * The edit delta. Exported for tests — a one-sided diff here silently leaves people's access in
 * place while the save reports success.
 */
export function buildDelta(
  original: ShareDTO,
  next: {
    name: string
    resources: ShareResource[]
    members: Member[]
    cascade: boolean
  }
) {
  const wasResources = new Map((original.resources ?? []).map((r) => [r.id, r]))
  const nowResources = new Map(next.resources.map((r) => [r.id, r]))
  const wasMembers = new Map((original.members ?? []).map((m) => [m.userId, m]))
  const nowMembers = new Map(next.members.map((m) => [m.userId, m]))

  const addResources = next.resources
    .filter((r) => !wasResources.has(r.id))
    .map((r) => ({ type: r.type, id: r.id }))
  const removeResources = (original.resources ?? [])
    .filter((r) => !nowResources.has(r.id))
    .map((r) => ({ type: r.type, id: r.id }))

  const addMembers = next.members.filter((m) => !wasMembers.has(m.userId))
  const updateMembers = next.members.filter((m) => {
    const before = wasMembers.get(m.userId)
    return !!before && before.permission !== m.permission
  })
  // `members.remove` is bare userId strings while `resources.remove` is `{type,id}` objects.
  const removeMembers = (original.members ?? [])
    .filter((m) => !nowMembers.has(m.userId))
    .map((m) => m.userId)

  const body: Record<string, unknown> = {}
  if (next.name !== original.name) body.name = next.name
  if (next.cascade !== !!original.includeDescendants) {
    body.includeDescendants = next.cascade
  }
  if (addResources.length || removeResources.length) {
    body.resources = {
      ...(addResources.length ? { add: addResources } : {}),
      ...(removeResources.length ? { remove: removeResources } : {}),
    }
  }
  if (addMembers.length || updateMembers.length || removeMembers.length) {
    body.members = {
      ...(addMembers.length ? { add: addMembers } : {}),
      ...(updateMembers.length ? { update: updateMembers } : {}),
      ...(removeMembers.length ? { remove: removeMembers } : {}),
    }
  }
  return body
}
