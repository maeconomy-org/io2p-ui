'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowRight,
  ChevronRight,
  Globe,
  History,
  Info,
  Loader2,
  RotateCcw,
  UserPlus,
  X,
} from 'lucide-react'
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
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { useAuth } from '@/contexts'
import { useGrants, useShares } from '@/hooks/api/access'
import { useTemplates } from '@/hooks/api/entities'
import { useUserSearch } from '@/hooks/api/users'
import { UnsavedBar } from '@/components/entity-sheet/sheet-lifecycle-footer'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import { cn } from '@/lib/utils'

import { PermissionSelect, type Permission } from './permission-select'
import { ShareDependencies, splitDependencies } from './share-dependencies'

/** What a Share sheet can be opened on — all five, since who-can-access widened to match grant. */
export type ShareResourceType =
  | 'object'
  | 'process'
  | 'formula'
  | 'constant'
  | 'template'

/**
 * Formulas, constants and templates are READ-SHARE ONLY (C3): `READ_SHARE_ONLY` is enforced in the
 * node's rules layer, so any other permission 400s. Offering the ladder would render choices the
 * node refuses.
 */
export function isReadOnlyResource(type: ShareResourceType) {
  return type === 'formula' || type === 'constant' || type === 'template'
}

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

/** A grant this sheet can actually write: active, and not owned by a Share. */
const isDirect = (g: GrantDTO) => !g.shareId

/**
 * Only ACTIVE, DIRECT grants become editable rows.
 *
 * io2p keys a grant by (resource, subject, SOURCE): an ad-hoc grant and each Share that covers the
 * same pair are SEPARATE entities, and effective access is their union (most-permissive wins).
 * `revoke` without a shareId targets the direct row only — so a Share-sourced grant cannot be
 * removed from here at all, and staging one as editable would render controls whose writes are
 * silently a no-op.
 *
 * Revoked rows are excluded for a different reason: seeding one would list a removed person as a
 * member, and the diff would re-grant them on the next Save.
 */
function draftFromGrants(grants: GrantDTO[]): Draft {
  const draft: Draft = {}
  for (const grant of grants.filter((g) => g.active && isDirect(g))) {
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
  directOnly = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ShareTarget
  /** Only an owner/admin may read the grant list; the node 403s everyone else. */
  isOwner: boolean
  /**
   * Show ONLY ad-hoc grants — nothing a Share owns, in any section.
   *
   * Set when opening from the Direct shares tab, which exists precisely to separate the two kinds.
   * Arriving there and finding bundle rows with "Manage bundle" makes the separation look broken,
   * even though the rows are real.
   *
   * DEFAULT FALSE, because the entry point from an object or process is the access design's §4 tab:
   * it answers "who can access this thing", and hiding a source there would understate the answer.
   */
  directOnly?: boolean
}) {
  const t = useTranslations()

  const { useList } = useGrants()
  const resource = useMemo(
    () => ({ resourceType: target.type, resourceId: target.id }),
    [target.type, target.id]
  )
  // `revoked: 'include'` on the ONE read: active and revoked rows arrive together, so showing
  // history is a filter over what is already here rather than a second request and a second
  // loading state. They are split below — a revoked row must never reach the editable draft.
  //
  // `source` narrows by ORIGIN at the node, so `directOnly` never sees a bundle row at all — every
  // section below (members, revoked history, the bundle group) reads the same narrowed set and
  // cannot disagree about what is on screen.
  const { data: grantsPage, isLoading } = useList(
    resource,
    { revoked: 'include', source: directOnly ? 'direct' : 'all' },
    { enabled: open && isOwner }
  )

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
  const format = useFormatter()
  const { userId } = useAuth()

  const initial = useMemo(() => draftFromGrants(grants), [grants])
  const [draft, setDraft] = useState<Draft>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const { useGrant, useRevoke } = useGrants()
  const grantMutation = useGrant()
  const revokeMutation = useRevoke()

  // Only a template has a recipe to walk. Asked for once per sheet rather than per member: the
  // answer is about the TEMPLATE, and deliberately says nothing about who is receiving it.
  const { data: dependencies } = useTemplates().useShareDependencies(
    target.type === 'template' ? target.id : undefined
  )
  const [shareDependencies, setShareDependencies] = useState(false)

  const memberIds = Object.keys(draft).filter((key) => key !== PUBLIC_KEY)

  // No directory here any more: every name on screen either arrived resolved on its grant or was
  // staged by the picker that displayed it. CANDIDATES still come from a server search, which is
  // what lets the picker reach a user no single page of the directory would have held.
  const { users, isFetching: searching } = useUserSearch(peopleQuery, {
    enabled: pickerOpen,
  })

  const cascade = canCascade(target.type)
  const readOnly = isReadOnlyResource(target.type)
  const publicMember = draft[PUBLIC_KEY]

  /**
   * Who USED TO have access and does not now.
   *
   * Keyed by (subject, SOURCE), because io2p keys a grant that way: someone can hold a live
   * Share-sourced grant while their old ad-hoc one sits revoked, and those are two real rows, not a
   * duplicate. Collapsing them by subject hid a genuine revocation; ignoring source entirely listed
   * people as former while they were sitting in the members list above.
   *
   * Grants are APPEND-ONLY (a revoked row is kept for audit/rebuild), so a subject revoked more than
   * once from the same source collapses to their most recent removal.
   */
  const revoked = useMemo(() => {
    const sourceOf = (g: GrantDTO) =>
      `${keyOf(g.subject)}::${g.shareId ?? 'direct'}`
    const live = new Set(grants.filter((g) => g.active).map(sourceOf))
    const latest = new Map<string, GrantDTO>()

    for (const g of grants) {
      if (g.active) continue
      const key = sourceOf(g)
      if (live.has(key)) continue
      const seen = latest.get(key)
      if (!seen || g.updatedAt > seen.updatedAt) latest.set(key, g)
    }

    return [...latest.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [grants])

  /**
   * Names for the bundles on screen, so a row can say "via Q3 rollout" rather than a uuid.
   *
   * ONE list read for the whole sheet, not one per row — the access design says so explicitly
   * ("Do not call this endpoint per-row on the list (N+1)"). A share outside the first page simply
   * stays unnamed and the chip falls back to a link, which is a smaller failure than N requests.
   */
  const { useList: useShareList, useUpdate: useShareUpdate } = useShares()
  const { data: sharesPage } = useShareList(
    { page: 1, size: 100 },
    { enabled: grants.some((g) => g.shareId) }
  )
  const shareOf = (shareId: string) =>
    sharesPage?.data.find((s) => s.id === shareId)
  const shareNameOf = (shareId: string) => shareOf(shareId)?.name

  const shareUpdate = useShareUpdate()
  const [removingFrom, setRemovingFrom] = useState<GrantDTO | null>(null)

  /**
   * Remove a member from the BUNDLE (§4, amended 2026-08-03).
   *
   * This does not inline-edit the grant — the rule that forbids that guards against the bundle
   * drifting from its expansion. It edits the BUNDLE, and the shares service re-syncs the grants,
   * so the desync cannot occur.
   *
   * The confirm names the items because a Share is a CROSS PRODUCT: removing a member removes them
   * from EVERY resource in it. `ShareDTO` carries `resources` in full, so the scope is resolved and
   * shown before it fires rather than described in a button label.
   */
  const removeFromShare = async () => {
    const grant = removingFrom
    if (!grant?.shareId || grant.subject.kind !== 'user') return
    try {
      await shareUpdate.mutateAsync({
        id: grant.shareId,
        body: { members: { remove: [grant.subject.userId] } },
      })
      toast.success(t('access.removedFromShare'))
      onDone()
    } catch (error) {
      logger.error('Remove from share failed', { err: error })
      toast.error(
        t('access.saveFailedFor', { names: subjectName(grant.subject) })
      )
    } finally {
      setRemovingFrom(null)
    }
  }

  /**
   * Access that comes from a Share, listed but NOT editable here.
   *
   * A Share owns its own grant rows; `revoke` from this sheet carries no shareId and so targets the
   * direct row, returning `revoked: false` when there isn't one. Offering an X and a permission
   * select would be two controls that look normal and do nothing — the exact failure this codebase
   * keeps producing. Editing belongs to the Share.
   */
  const fromShares = useMemo(
    () => grants.filter((g) => g.active && g.shareId),
    [grants]
  )
  const [showRevoked, setShowRevoked] = useState(false)

  /**
   * Restoring costs no new endpoint: `grant` UPSERTS on (resource, subject), so re-sending the
   * permission the subject held reactivates the same row. Applied immediately rather than staged —
   * unlike the rows above, there is nothing here to diff against.
   */
  const restore = async (grant: GrantDTO) => {
    try {
      await grantMutation.mutateAsync({
        body: {
          resource: { type: target.type, id: target.id },
          subject: grant.subject,
          permission: grant.permission,
          ...(cascade
            ? { includeDescendants: !!grant.includeDescendants }
            : {}),
        },
      })
      toast.success(t('access.saved'))
      onDone()
    } catch (error) {
      logger.error('Restore grant failed', { err: error })
      toast.error(
        t('access.saveFailedFor', { names: subjectName(grant.subject) })
      )
    }
  }

  /**
   * The one way this sheet turns a subject into a label.
   *
   * `name` is resolved by the node on read, so it is current at the moment of the request — a
   * rename shows immediately, and there is no page of users to fall off the end of. Absent means
   * unresolved (no display name, or the id no longer maps), NOT blank: falling back to the id keeps
   * an unresolved grantee looking unresolved rather than nameless.
   */
  const subjectName = (subject: GrantDTO['subject']) =>
    subject.kind === 'public'
      ? t('access.publicLabel')
      : (subject.name ?? subject.userId)

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

  /**
   * Apply each edit INDEPENDENTLY, revokes first.
   *
   * Two deliberate choices, both bought by a real report ("I can't revoke one user from this
   * share"):
   *
   * - **Revokes go first.** They used to run after every grant, in one `try` — so a single failing
   *   grant, on an unrelated member, aborted the loop before any revoke ran. Taking access away is
   *   the half the user asked for most urgently, and it is the fail-safe direction: a grant that
   *   then fails leaves LESS access, never more.
   * - **One failure no longer cancels the rest.** Sequential-and-abort made the outcome depend on
   *   member ORDER, which the user cannot see. Each edit stands alone; whatever failed is named.
   *
   * The sheet stays OPEN when anything failed, so the refetched list shows what actually landed
   * rather than closing over a half-applied state.
   */
  const save = async () => {
    setSaving(true)
    const failed: { key: string; error: unknown }[] = []
    // Kept apart from `failed`, which is keyed by MEMBER and rolls their row back.
    const failedDependencies: string[] = []

    const attempt = async (key: string, run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        logger.error('Access change failed', { err: error, subject: key })
        failed.push({ key, error })
      }
    }

    try {
      for (const key of removed) {
        await attempt(key, () =>
          revokeMutation.mutateAsync({
            body: {
              resource: { type: target.type, id: target.id },
              subject: initial[key].subject,
            },
          })
        )
      }

      // `grant` upserts on (resource, subject), so an added member and a changed rung are the same
      // call — the diff only has to say WHICH subjects differ, not how.
      for (const [key, member] of changed) {
        await attempt(key, () =>
          grantMutation.mutateAsync({
            body: {
              resource: { type: target.type, id: target.id },
              subject: member.subject,
              permission: member.permission,
              ...(cascade
                ? { includeDescendants: member.includeDescendants }
                : {}),
            },
          })
        )
      }

      /**
       * The template's formulas and constants, to everyone who can hold a grant on one.
       *
       * AFTER the members, so a failure here cannot cost someone the share itself — and tracked
       * SEPARATELY from them, because `failed` drives a draft rollback: a member whose share landed
       * but whose formula did not would otherwise be snapped back to "not shared" on screen.
       *
       * Always `read` (the node accepts nothing else on a library item), and `grant` upserts, so a
       * member who already holds one costs a no-op rather than a pre-check.
       */
      if (shareDependencies) {
        const targets = splitDependencies(dependencies).grantable
        // `public` is skipped: making a template public does not make the whole library public, and
        // that is a decision to take on each item rather than a side effect of sharing one template.
        const recipients = Object.values(draft).filter(
          (m) => m.subject.kind === 'user'
        )
        for (const member of recipients) {
          for (const dep of targets) {
            try {
              await grantMutation.mutateAsync({
                body: {
                  resource: { type: dep.type, id: dep.id },
                  subject: member.subject,
                  permission: 'read',
                },
              })
            } catch (error) {
              logger.error('Dependency grant failed', {
                err: error,
                resourceId: dep.id,
              })
              failedDependencies.push(dep.name || dep.id)
            }
          }
        }
      }
    } finally {
      // In `finally` because there is more than one way out now: anything unexpected outside
      // `attempt` would otherwise leave Save spinning and disabled with no way to retry.
      setSaving(false)
    }

    if (failed.length === 0) {
      // The share landed either way — but a template whose formulas did not follow will not compute
      // for the people who just received it, and saying only "Saved" would hide that.
      if (failedDependencies.length > 0) {
        toast.warning(t('access.saved'), {
          description: t('access.dependenciesFailed', {
            names: failedDependencies.join(', '),
          }),
        })
      } else {
        toast.success(t('access.saved'))
      }
      onDone()
      return
    }

    /**
     * Snap the FAILED rows back to what the server still holds.
     *
     * Partial application breaks the assumption the old abort-on-first-error gave for free — that
     * the draft equals server state. Left alone, a failed row keeps rendering the permission the
     * user ASKED for, so a 403 looks exactly like a success. Rows that succeeded keep the user's
     * input because that IS now the truth; `initial` is untouched for the failed ones precisely
     * because their write never landed.
     */
    setDraft((d) => {
      const next = { ...d }
      for (const { key } of failed) {
        if (initial[key]) next[key] = initial[key]
        else delete next[key]
      }
      return next
    })

    // The mapped reason (403, 409, 412 …) rather than one flat string — but only when a single
    // failure means there IS one reason. Several failures can differ, so those get the names alone.
    const { key, values } =
      failed.length === 1
        ? saveErrorMessage(failed[0].error)
        : { key: 'access.saveFailedReason', values: undefined }

    toast.error(
      t('access.saveFailedFor', {
        names: failed.map((f) => labelForKey(f.key)).join(', '),
      }),
      { description: t(key, values) }
    )
  }

  /**
   * Same label, reached by draft key rather than by subject — the rows and the error paths are
   * keyed, not carried. `initial` is the fallback because a failed row is resynced out of the draft
   * before the toast that names it renders.
   */
  const labelForKey = (key: string) => {
    const staged = draft[key] ?? initial[key]
    if (staged) return subjectName(staged.subject)
    return key === PUBLIC_KEY ? t('access.publicLabel') : key
  }

  return (
    <>
      <SheetBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('access.shareDescription')}
        </p>

        {readOnly && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('access.readShareOnly')}</span>
          </p>
        )}

        <div className="space-y-2">
          <Label>{t('access.peopleWithAccess')}</Label>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="truncate text-sm">{t('common.me')}</span>
            <Badge variant="secondary" className="h-5">
              {t('access.owner')}
            </Badge>
          </div>

          {memberIds.map((id) => (
            <div
              key={id}
              className="space-y-2 rounded-md border px-3 py-2"
              data-testid={`share-member-${id}`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {labelForKey(id)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('access.revokeFor', { name: labelForKey(id) })}
                  data-testid={`share-member-remove-${id}`}
                  onClick={() => removeMember(id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <PermissionSelect
                className="w-full"
                testId={`share-member-permission-${id}`}
                value={draft[id].permission}
                disabled={readOnly}
                aria-label={t('access.permissionFor', {
                  name: labelForKey(id),
                })}
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

          {/* Read-only, and deliberately so: these rows say WHO has access without pretending this
              sheet can change it. Every control is absent rather than disabled-looking, so there is
              nothing to click that would no-op. */}
          {fromShares.map((grant) => (
            <div
              key={grant.id}
              className="space-y-2 rounded-md border border-dashed px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {subjectName(grant.subject)}
                </span>
                <Badge variant={grant.permission} className="h-5 shrink-0">
                  {t(`access.permission.${grant.permission}`)}
                </Badge>
              </div>
              <ViaShareChip
                shareId={grant.shareId!}
                name={shareNameOf(grant.shareId!)}
                onRemove={
                  grant.subject.kind === 'user'
                    ? () => setRemovingFrom(grant)
                    : undefined
                }
              />
            </div>
          ))}

          {memberIds.length === 0 && fromShares.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('access.notShared')}
            </p>
          )}
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-testid="share-add-people"
            >
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
                data-testid="people-search"
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
                            // Stage the name the picker just showed. A staged row has no grant to
                            // resolve from, so without this the person you picked by name becomes
                            // a uuid the moment they land in the list.
                            subject: {
                              kind: 'user',
                              userId: user.id,
                              name: user.displayName || user.email,
                            },
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
              data-testid="share-public-toggle"
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

        {revoked.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            {/* Chevron FIRST and rotating, matching the flow and property rows — a heading that
                expands has to look like one before it is clicked, not only after. `aria-expanded`
                says the same thing to a screen reader either way. */}
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md text-left text-sm font-medium hover:text-foreground/80"
              aria-expanded={showRevoked}
              data-testid="revoked-toggle"
              onClick={() => setShowRevoked((v) => !v)}
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                  showRevoked && 'rotate-90'
                )}
                aria-hidden="true"
              />
              <History
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">{t('access.revokedTitle')}</span>
              <Badge
                variant="secondary"
                className="h-5"
                data-testid="revoked-count"
              >
                {revoked.length}
              </Badge>
            </button>

            {showRevoked && (
              <>
                {/* The ceiling, stated where it matters: the projection keeps WHO and the LAST
                    permission held, not the permission at revoke time. This answers "X used to
                    have access", never "X had write on the 3rd" — and a reader who assumes the
                    latter would be reading an audit trail that does not exist. */}
                <p className="text-xs text-muted-foreground">
                  {t('access.revokedHint')}
                </p>
                {revoked.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2"
                    data-testid={`revoked-row-${keyOf(grant.subject)}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {subjectName(grant.subject)}
                    </span>
                    <Badge
                      variant="secondary"
                      className="h-5 shrink-0"
                      data-testid="permission-badge"
                    >
                      {t(`access.permission.${grant.permission}`)}
                    </Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format.dateTime(new Date(grant.updatedAt), {
                        dateStyle: 'medium',
                      })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      data-testid={`revoked-restore-${keyOf(grant.subject)}`}
                      onClick={() => restore(grant)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      {t('common.restore')}
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Last in the body, next to Save: it modifies the write rather than describing the
            entity, so it belongs beside the button that performs it — above the member list it
            read as a property of the template. */}
        <ShareDependencies
          deps={dependencies}
          checked={shareDependencies}
          onCheckedChange={setShareDependencies}
        />
      </SheetBody>

      {removingFrom && (
        <DeleteConfirmationDialog
          open
          onOpenChange={(open) => !open && setRemovingFrom(null)}
          objectName=""
          title={t('access.removeFromShareTitle', {
            name: subjectName(removingFrom.subject),
            share: shareNameOf(removingFrom.shareId!) ?? '',
          })}
          description={t('access.removeFromShareBody', {
            count: shareOf(removingFrom.shareId!)?.resources.length ?? 0,
            items:
              shareOf(removingFrom.shareId!)
                ?.resources.map((r) => r.name ?? r.id)
                .join(', ') ?? '',
          })}
          onDelete={removeFromShare}
        />
      )}

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
          data-testid="share-sheet-save"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </SheetFooter>
    </>
  )
}

/**
 * The §4 provenance chip: "via <bundle>" plus a deep-link to manage it there.
 *
 * Editing is restricted to the bundle ON PURPOSE — a grant edited here would drift from the Share
 * that expanded it. So this row's only affordance is the way to the place that owns it.
 */
function ViaShareChip({
  shareId,
  name,
  onRemove,
}: {
  shareId: string
  name?: string
  /** Omitted for `public`, which is not a share member and cannot be removed from one. */
  onRemove?: () => void
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {/* An unnamed share still gets a chip — the LINK is what matters, and "via " with nothing
            after it reads as a rendering fault rather than as a name we could not resolve. */}
        {name ? t('access.viaShare', { name }) : t('access.viaShareUnnamed')}
      </span>
      <Link
        href={`/shares?share=${shareId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {t('access.manageBundle')}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          {t('access.removeFromShare')}
        </Button>
      )}
    </div>
  )
}
