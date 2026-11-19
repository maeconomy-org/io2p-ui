'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Boxes, Copy, Users } from 'lucide-react'
import type { ShareDTO } from 'io2p-client'

import {
  Badge,
  Button,
  GridPagination,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { OwnerCell, formatTimestamp } from '@/components/entity-list'
import { SheetLifecycleFooter } from '@/components/entity-sheet/sheet-lifecycle-footer'

/** Small enough that a page fits the sheet without scrolling far, and bounds the name lookups. */
const PAGE_SIZE = 10

/**
 * A read-only look at a Share before editing it.
 *
 * A bundle can hold hundreds of resources, so opening straight into an editor asks the user to
 * change something they have not read yet. Overview answers "what is this", the two tabs page
 * through the contents, and Edit is a deliberate second step.
 *
 * Names arrive WITH the row — the node resolves `name`/`deleted` on the share read — so this needs
 * no lookup of its own. Paging is purely about scroll length.
 */
export function ShareDetailSheet({
  open,
  onOpenChange,
  share,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  share: ShareDTO
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const t = useTranslations()
  const [resourcePage, setResourcePage] = useState(1)
  const [memberPage, setMemberPage] = useState(1)

  const resources = share.resources ?? []
  const members = share.members ?? []

  const pageOf = <T,>(rows: T[], page: number) =>
    rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagesOf = (rows: unknown[]) => Math.ceil(rows.length / PAGE_SIZE) || 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <span className="min-w-0 truncate">{share.name}</span>
            {share.deleted && (
              <Badge variant="outline" className="h-5 shrink-0">
                {t('objects.deletedBadge')}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('shares.editorDescription')}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger
                value="overview"
                data-testid="share-detail-tab-overview"
              >
                {t('shares.tabOverview')}
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                data-testid="share-detail-tab-resources"
              >
                <Boxes className="mr-1.5 h-3.5 w-3.5" />
                {resources.length}
              </TabsTrigger>
              <TabsTrigger
                value="members"
                data-testid="share-detail-tab-members"
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                {members.length}
              </TabsTrigger>
            </TabsList>
          </div>

          <SheetBody>
            <TabsContent value="overview" className="mt-0 space-y-4">
              <Field label={t('shares.fields.name')}>{share.name}</Field>
              <Field label={t('common.owner')}>
                <OwnerCell
                  ownerUserId={share.ownerUserId}
                  ownerName={share.ownerName}
                />
              </Field>
              <Field label={t('shares.fields.cascade')}>
                {share.includeDescendants
                  ? t('shares.cascadeOn')
                  : t('common.no')}
              </Field>
              <Field label={t('objects.fields.created')}>
                {formatTimestamp(share.createdAt)}
              </Field>
              <Field label={t('shares.fields.updated')}>
                {formatTimestamp(share.updatedAt)}
              </Field>
              {share.deleted && share.deletedAt && (
                <Field label={t('objects.deletedBadge')}>
                  {formatTimestamp(share.deletedAt)}
                </Field>
              )}
            </TabsContent>

            <TabsContent value="resources" className="mt-0 space-y-2">
              {pageOf(resources, resourcePage).map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Badge variant={resource.type} className="h-5 shrink-0">
                    {t(`shares.resourceType.${resource.type}`)}
                  </Badge>
                  <ResourceLabel name={resource.name} id={resource.id} />
                  {resource.deleted && (
                    <Badge variant="outline" className="h-5 shrink-0">
                      {t('objects.deletedBadge')}
                    </Badge>
                  )}
                </div>
              ))}
              {resources.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('shares.noResourcesYet')}
                </p>
              )}
              {resources.length > PAGE_SIZE && (
                <GridPagination
                  currentPage={resourcePage}
                  totalPages={pagesOf(resources)}
                  totalElements={resources.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setResourcePage}
                />
              )}
            </TabsContent>

            <TabsContent value="members" className="mt-0 space-y-2">
              {pageOf(members, memberPage).map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {member.name ?? member.userId}
                  </span>
                  <Badge
                    variant={member.permission}
                    data-testid="permission-badge"
                    className="h-5 shrink-0"
                  >
                    {t(`access.permission.${member.permission}`)}
                  </Badge>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('shares.noMembersYet')}
                </p>
              )}
              {members.length > PAGE_SIZE && (
                <GridPagination
                  currentPage={memberPage}
                  totalPages={pagesOf(members)}
                  totalElements={members.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setMemberPage}
                />
              )}
            </TabsContent>
          </SheetBody>
        </Tabs>

        {/* A deleted share cannot be edited and has no restore, so it gets the one action that
            does work. Everything live uses the shared lifecycle footer — same Edit/Delete shape and
            the same two-step confirm as the object detail sheet. */}
        {share.deleted ? (
          <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
            <Button type="button" className="flex-1" onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              {t('shares.duplicate')}
            </Button>
          </SheetFooter>
        ) : (
          <SheetLifecycleFooter
            editing={false}
            isCreate={false}
            isDeleted={false}
            isDirty={false}
            isSubmitting={false}
            lifecycleBusy={false}
            canDelete
            onEdit={onEdit}
            onCancel={() => onOpenChange(false)}
            onDelete={onDelete}
            onRestore={() => {}}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Falls back to the id: an unresolved ref should look unresolved, not absent. */
function ResourceLabel({ name, id }: { name?: string; id: string }) {
  if (name) return <span className="truncate">{name}</span>
  return (
    <span className="truncate font-mono text-xs text-muted-foreground">
      {id}
    </span>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}
