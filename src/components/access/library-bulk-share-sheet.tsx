'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Globe, Info, Loader2, UserPlus, X } from 'lucide-react'
import type { GrantDTO } from 'io2p-client'

import type { ShareDependency } from '@/types'

import {
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
} from '@/components/ui'
import { useAuth } from '@/contexts'
import { useGrants } from '@/hooks/api/access'
import { useTemplates } from '@/hooks/api/entities'
import { useUserSearch } from '@/hooks/api/users'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

import { PermissionSelect, type Permission } from './permission-select'
import { ShareDependencies, splitDependencies } from './share-dependencies'
import {
  isReadOnlyResource,
  type ShareResourceType,
  type ShareTarget,
} from './share-sheet'

const PUBLIC_KEY = 'public'

interface Recipient {
  subject: GrantDTO['subject']
  label: string
}

/**
 * Every grant a bulk share will write: one per resource per recipient, since a grant is keyed on
 * (resource, subject) and there is no multi-resource form of it.
 *
 * ONE read-only resource pins the whole run to `read`. The grants go out with a single permission,
 * and `READ_SHARE_ONLY` in the node's rules layer 400s a formula, constant or template given
 * anything else — so a mixed selection has to take the permission every member accepts.
 */
export function bulkGrantPlan(
  resources: ShareTarget[],
  recipients: Recipient[],
  permission: Permission,
  /**
   * Formulas and constants the selected templates bind, already filtered to the grantable ones.
   * They ride along at `read` whatever the selection's own permission is — the node accepts nothing
   * else on a library item — and are deduped by the caller, since two templates commonly share one.
   */
  dependencies: ShareDependency[] = []
) {
  const effective: Permission = resources.some((r) =>
    isReadOnlyResource(r.type)
  )
    ? 'read'
    : permission

  const plan = resources.flatMap((resource) =>
    recipients.map((recipient) => ({
      resource: { type: resource.type, id: resource.id },
      subject: recipient.subject,
      permission: effective,
    }))
  )

  // Last, so a dependency failure cannot cost the selection itself — the grants run in order and
  // stop on the first error.
  //
  // `public` is skipped: sharing a template with everyone is not a decision to publish the whole
  // library behind it, and that one is taken per item rather than as a side effect here.
  const named = recipients.filter((r) => r.subject.kind === 'user')
  return plan.concat(
    dependencies.flatMap((dep) =>
      named.map((recipient) => ({
        resource: { type: dep.type, id: dep.id },
        subject: recipient.subject,
        permission: 'read' as Permission,
      }))
    )
  )
}

/**
 * Share a SELECTION in one go, as direct grants.
 *
 * Deliberately not the Share editor: that builds a named bundle, and `ShareResourceShape` is
 * object|process — the node rejects formulas, constants and templates outright. A grant has no such
 * limit, so bulk sharing them is one upsert per resource per person, which is what this does.
 *
 * ADDITIVE, and says so. It does not read the existing grants for every selected row (that would be
 * N requests just to open) and therefore cannot show or revoke them. Adding someone here never takes
 * access away from anyone; removing is still per-entity, where the full picture is on screen.
 */
export function LibraryBulkShareSheet({
  open,
  onOpenChange,
  resources,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resources: ShareTarget[]
  /** Called after a successful write — used to clear the selection. */
  onDone?: () => void
}) {
  const t = useTranslations()
  const { userId } = useAuth()

  const [recipients, setRecipients] = useState<Record<string, Recipient>>({})
  const [permission, setPermission] = useState<Permission>('read')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const { useGrant } = useGrants()
  const grantMutation = useGrant()

  // Only the templates in the selection have recipes to walk, and two of them commonly bind the
  // same formula — the hook merges by id so it is offered once and granted once.
  const templateIds = useMemo(
    () => resources.filter((r) => r.type === 'template').map((r) => r.id),
    [resources]
  )
  const dependencies = useTemplates().useShareDependenciesFor(templateIds)
  const [shareDependencies, setShareDependencies] = useState(false)

  // Recipients are STAGED, never read back, so the name is whatever the picker showed when it was
  // picked — and the picker searches the server, so it reaches users no directory page would hold.
  // This used to prefer a cached-directory lookup that never returns falsy, which made the staged
  // label unreachable: past the directory's page the picker showed a name and the row showed a uuid.
  const { users, isFetching: searching } = useUserSearch(peopleQuery, {
    enabled: pickerOpen,
  })

  // One read-only resource in the selection pins the whole run to `read`: the grants go out with a
  // single permission, and the node 400s a formula/constant/template given anything else.
  const readOnly = resources.some((r) => isReadOnlyResource(r.type))

  const candidates = users.filter((u) => u.id !== userId && !recipients[u.id])
  const count = Object.keys(recipients).length

  const remove = (key: string) =>
    setRecipients((r) => {
      const next = { ...r }
      delete next[key]
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      // Sequential, like every other bulk run here: a partial failure should stop rather than
      // scatter an unknown subset of grants.
      for (const body of bulkGrantPlan(
        resources,
        Object.values(recipients),
        permission,
        shareDependencies ? splitDependencies(dependencies).grantable : []
      )) {
        await grantMutation.mutateAsync({ body })
      }
      toast.success(t('access.bulkShared', { count: resources.length }))
      onDone?.()
      onOpenChange(false)
    } catch (error) {
      logger.error('Bulk share failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>
            {t('access.bulkShareTitle', { count: resources.length })}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('access.bulkShareDescription')}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('access.bulkShareDescription')}
          </p>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {readOnly
                ? t('access.readShareOnly')
                : t('access.bulkShareAdditive')}
            </span>
          </p>

          <div className="space-y-2">
            <Label>{t('access.peopleWithAccess')}</Label>

            {Object.entries(recipients).map(([key, recipient]) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {key === PUBLIC_KEY
                    ? t('access.publicHint')
                    : recipient.label}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('access.revokeFor', { name: recipient.label })}
                  onClick={() => remove(key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {count === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('access.bulkShareNobody')}
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
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              {/* The server already filtered; letting cmdk filter again would hide rows it matched
                  on a field cmdk cannot see. */}
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
                          setRecipients((r) => ({
                            ...r,
                            [user.id]: {
                              subject: { kind: 'user', userId: user.id },
                              label: user.displayName || user.email || user.id,
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

          {!readOnly && (
            <div className="space-y-2">
              <Label>{t('access.permission.read')}</Label>
              <PermissionSelect
                className="w-full"
                value={permission}
                onChange={setPermission}
              />
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label>{t('access.publicLabel')}</Label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={!!recipients[PUBLIC_KEY]}
                onCheckedChange={(checked) =>
                  checked === true
                    ? setRecipients((r) => ({
                        ...r,
                        [PUBLIC_KEY]: {
                          subject: { kind: 'public' },
                          label: t('access.publicHint'),
                        },
                      }))
                    : remove(PUBLIC_KEY)
                }
              />
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                {t('access.publicHint')}
              </span>
            </label>
          </div>

          {/* Last in the body, beside Save — it modifies the write rather than describing the
              selection. */}
          <ShareDependencies
            deps={dependencies}
            checked={shareDependencies}
            onCheckedChange={setShareDependencies}
          />
        </SheetBody>

        <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={count === 0 || saving}
            onClick={save}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('access.share')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export type { ShareResourceType }
