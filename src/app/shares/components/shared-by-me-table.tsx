'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Ban, Share2 } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { SharedByMeItem } from 'io2p-client'

import { BulkActionBar, EntityTable } from '@/components/entity-list'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { useGrants } from '@/hooks/api/access'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import { usePageSize } from '@/hooks/ui/use-page-size'

import { buildSharedByMeColumns } from './shared-by-me-columns'
import { ManageAccessSheet } from './manage-access-sheet'

/**
 * DIRECT shares only — the ad-hoc grants made from an item's own Share sheet.
 *
 * Bundle-owned grants are filtered OUT, which is what the access design's §9 always specified
 * ("[Bundles] | [Direct shares]", `direct` being core's own word for a grant with no `shareId`).
 * It could not be implemented until the rollup carried `shareId`, so this tab shipped showing both
 * kinds mixed — and that single fact produced every confusing thing about this page: rows that look
 * identical but where half the actions silently do nothing, and a "Revoke all" that under-delivers.
 *
 * With the two separated, each tab is internally consistent: one kind of thing, one set of actions,
 * all of which work on every row.
 */
export function SharedByMeTable() {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  const [pageSize, handlePageSizeChange] = usePageSize(
    useCallback(() => setPage(1), [])
  )

  const [managing, setManaging] = useState<SharedByMeItem | null>(null)
  const [revoking, setRevoking] = useState<SharedByMeItem | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulk, setConfirmBulk] = useState(false)

  const { useSharedByMe, useRevoke } = useGrants()
  /**
   * `source: 'direct'` is the whole filter, done by the node.
   *
   * A resource whose grants are ALL bundle-owned drops out entirely — it is not a direct share, and
   * listing it would put back the row that cannot be revoked from here. Because the node applies
   * that before paginating, `totalElements` counts exactly the rows this tab lists.
   */
  const { data, isFetching } = useSharedByMe(
    { page, size: pageSize, source: 'direct' },
    { keepPreviousData: true }
  )
  const revokeMutation = useRevoke()

  const items = useMemo(() => data?.data ?? [], [data])

  /**
   * Revoke every grant on this resource — and here that means ALL of them, because the rows are
   * already filtered to direct grants. A `revoke` with no shareId targets exactly the row shown.
   *
   * This is the payoff of splitting the tabs: the action no longer needs to explain what it could
   * not reach, because nothing unreachable is on screen.
   */
  const confirmRevokeAll = useCallback(async () => {
    if (!revoking) return
    try {
      for (const grant of revoking.grants) {
        await revokeMutation.mutateAsync({
          body: { resource: revoking.resource, subject: grant.subject },
        })
      }
      toast.success(t('shares.revokedAll'))
    } catch (error) {
      logger.error('Revoke all failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      setRevoking(null)
    }
  }, [revoking, revokeMutation, t])

  const selected = useMemo(
    () => items.filter((item) => rowSelection[item.resource.id]),
    [items, rowSelection]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const runBulkRevoke = useCallback(async () => {
    // Sequential — a partial failure should stop rather than leave an unknown subset revoked.
    try {
      for (const item of selected) {
        for (const grant of item.grants) {
          await revokeMutation.mutateAsync({
            body: { resource: item.resource, subject: grant.subject },
          })
        }
      }
      toast.success(t('shares.revokedAll'))
    } catch (error) {
      logger.error('Bulk revoke failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    } finally {
      clearSelection()
    }
  }, [selected, revokeMutation, clearSelection, t])

  const columns = useMemo(
    () =>
      buildSharedByMeColumns({
        t,
        onManage: setManaging,
        onRevokeAll: setRevoking,
      }),
    [t]
  )

  return (
    <>
      <EntityTable
        columns={columns}
        page={data}
        getRowId={(item) => item.resource.id}
        fetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        pageSize={pageSize}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        emptyIcon={<Share2 className="h-10 w-10 text-muted-foreground/50" />}
        emptyTitle={t('shares.sharedByMeEmpty.title')}
        emptyDescription={t('shares.sharedByMeEmpty.description')}
      />

      {/* `deleteLabel` is the revoke wording — the destructive slot is the same, the verb is not. */}
      <BulkActionBar
        count={selected.length}
        onClear={clearSelection}
        busy={revokeMutation.isPending}
        deleteLabel={t('shares.revokeAll')}
        deleteIcon={Ban}
        onDelete={() => setConfirmBulk(true)}
      />

      <DeleteConfirmationDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        objectName=""
        title={t('shares.revokeAllTitle')}
        description={`${t('shares.bulk.revokeDescription', {
          count: selected.length,
        })} ${t('shares.revokeAllBundleWarning')}`}
        confirmLabel={t('shares.revokeAll')}
        disabled={revokeMutation.isPending}
        onDelete={runBulkRevoke}
      />

      {managing && (
        <ManageAccessSheet
          resource={managing.resource}
          onClose={() => setManaging(null)}
        />
      )}

      {/* The same destructive confirm every delete uses, with the copy overridden.
          `POST /access/revoke` carries no shareId, and the projection is keyed by
          (resource, subject, SOURCE) — so this only ever tombstones the `direct` row. A grant a
          Share expanded lives under `share:<id>` and survives untouched, which is D75 working as
          designed and not something to route around. The copy says so. */}
      <DeleteConfirmationDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        objectName={revoking?.resource.id ?? ''}
        title={t('shares.revokeAllTitle')}
        description={`${t('shares.revokeAllDescription', {
          count: revoking?.grants.length ?? 0,
        })} ${t('shares.revokeAllBundleWarning')}`}
        confirmLabel={t('shares.revokeAll')}
        disabled={revokeMutation.isPending}
        onDelete={confirmRevokeAll}
      />
    </>
  )
}
