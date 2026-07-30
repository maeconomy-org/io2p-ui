'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Ban, Share2 } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { SharedByMeItem } from 'io2p-client'

import { BulkActionBar, EntityTable } from '@/components/tables'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useGrants } from '@/hooks/api/access'
import { useUserDirectory } from '@/hooks/api/users'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

import { useResourceDirectory } from '../hooks/use-resource-directory'
import { buildSharedByMeColumns } from './shared-by-me-columns'
import { ManageAccessSheet } from './manage-access-sheet'

/**
 * Everything the signed-in user has shared.
 *
 * This is the only place ad-hoc grants — the ones made from an item's own Share sheet — can be seen
 * together; bundle-owned grants appear here too.
 */
export function SharedByMeTable() {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)

  const [managing, setManaging] = useState<SharedByMeItem | null>(null)
  const [revoking, setRevoking] = useState<SharedByMeItem | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulk, setConfirmBulk] = useState(false)

  const { useSharedByMe, useRevoke } = useGrants()
  const { data, isFetching } = useSharedByMe(
    { page, size: pageSize },
    { keepPreviousData: true }
  )
  const revokeMutation = useRevoke()

  // Memoised because `?? []` is a fresh array each render, which would make every dependent memo
  // recompute on every render.
  const items = useMemo(() => data?.data ?? [], [data])
  // Only pay for the directory once there is a name to resolve.
  const { nameOf } = useUserDirectory({ enabled: items.length > 0 })
  const { nameOf: resourceNameOf, isDeleted: resourceDeleted } =
    useResourceDirectory(items.length > 0)

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [])

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
      logger.error('Revoke all failed', error)
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
      logger.error('Bulk revoke failed', error)
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
        nameOf,
        resourceNameOf,
        resourceDeleted,
        onManage: setManaging,
        onRevokeAll: setRevoking,
      }),
    [t, nameOf, resourceNameOf, resourceDeleted]
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
