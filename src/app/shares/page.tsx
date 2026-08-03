'use client'

import { useState, useCallback, useMemo } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { PlusCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ShareDTO } from 'io2p-client'

import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { FilterMenu, deletedSection } from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useShares } from '@/hooks/api/access'
import { useSearch } from '@/contexts'
import { DEFAULT_TABLE_PAGE_SIZE, anchor } from '@/constants'
import { logger } from '@/lib/logger'

import { buildShareColumns } from './components/share-columns'
import { PeopleAccessView } from './components/people-access-view'
import { SharedByMeTable } from './components/shared-by-me-table'
import {
  ShareEditorSheet,
  type ShareEditorMode,
} from './components/share-editor-sheet'
import { ShareDetailSheet } from './components/share-detail-sheet'
import { PageHelp } from '@/components/onboarding/page-help'
import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'

export default function SharesPage() {
  const t = useTranslations()

  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [toDelete, setToDelete] = useState<ShareDTO | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  // Controlled, so the Filters button can be shown only for the tab it filters.
  const [tab, setTab] = useState('shares')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [editor, setEditor] = useState<{
    mode: ShareEditorMode
    share: ShareDTO | null
  } | null>(null)
  const [viewing, setViewing] = useState<ShareDTO | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()

  const listQuery = useEntityListQuery()
  const { useList, useDelete } = useShares()
  const deleteMutation = useDelete()

  const { data: sharesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
    },
    { keepPreviousData: true }
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      listQuery.setPage(1)
    },
    [listQuery]
  )

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return
    try {
      await deleteMutation.mutateAsync({ id: toDelete.id })
      toast.success(t('shares.deleted'))
    } catch (error) {
      logger.error('Delete share failed', error)
      toast.error(t('shares.deleteFailed'))
    } finally {
      setToDelete(null)
    }
  }, [toDelete, deleteMutation, t])

  const selectedShares = useMemo(
    () => (sharesPage?.data ?? []).filter((s) => rowSelection[s.id]),
    [sharesPage, rowSelection]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])
  // With `deleted=include` the selection can hold rows that are already gone. There is no restore
  // for a share, so a deleted row has NO bulk action — offering Delete on it promises a no-op.
  const deletableShares = useMemo(
    () => selectedShares.filter((s) => !s.deleted),
    [selectedShares]
  )

  const runBulkDelete = useCallback(async () => {
    // Sequential, not Promise.all: each delete revokes every grant the bundle owns, and a partial
    // failure should stop rather than leave an unknown subset revoked.
    try {
      for (const share of deletableShares) {
        await deleteMutation.mutateAsync({ id: share.id })
      }
      toast.success(t('shares.deleted'))
    } catch (error) {
      logger.error('Bulk delete shares failed', error)
      toast.error(t('shares.deleteFailed'))
    } finally {
      clearSelection()
    }
  }, [deletableShares, deleteMutation, clearSelection, t])

  useTourAction(TOUR_ACTIONS.createShare, () =>
    setEditor({ mode: 'create', share: null })
  )

  const columns = useMemo(
    () =>
      buildShareColumns({
        t,
        actions: {
          // The row OPENS the read-only detail. A bundle can hold hundreds of resources, and
          // dropping straight into an editor asks the user to change what they have not read.
          onView: setViewing,
          onEdit: (share) => setEditor({ mode: 'edit', share }),
          onDuplicate: (share) => setEditor({ mode: 'duplicate', share }),
          onDelete: setToDelete,
        },
      }),
    [t]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          {/* Two questions, not two halves of one: "what bundles do I manage" and "what have I
              given away". The second includes ad-hoc grants that belong to no bundle.

              The Tabs wrap the header so the triggers can sit on the title row beside the action,
              rather than adding a third band of chrome above the table. */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="text-2xl font-semibold">{t('shares.title')}</h2>
                <PageHelp concept="share" tour="share-objects" />
              </div>
              <div className="flex items-center gap-2">
                <TabsList {...anchor('sharesTabs')}>
                  <TabsTrigger value="shares">
                    {t('shares.tabShares')}
                  </TabsTrigger>
                  <TabsTrigger value="sharedByMe">
                    {t('shares.tabSharedByMe')}
                  </TabsTrigger>
                  <TabsTrigger value="people">
                    {t('shares.tabPeople')}
                  </TabsTrigger>
                </TabsList>
                {/* Only the Shares list is filterable — `/access/shared-by-me` takes no filters
                    at all, so showing the control on that tab would offer something inert. */}
                {tab === 'shares' && (
                  <FilterMenu
                    sections={[deletedSection(t, showDeleted, setShowDeleted)]}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => setEditor({ mode: 'create', share: null })}
                  {...anchor('sharesCreate')}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('shares.create')}
                </Button>
              </div>
            </div>

            <TabsContent value="shares" className="space-y-4">
              {isSearchMode && (
                <SearchResultsBar
                  searchQuery={searchQuery}
                  resultsCount={sharesPage?.page.totalElements ?? 0}
                  onClearSearch={clearSearch}
                  raised={tab === 'shares' && selectedShares.length > 0}
                />
              )}

              <EntityTable
                columns={columns}
                page={sharesPage}
                getRowId={(share) => share.id}
                fetching={isFetching}
                sort={listQuery.query.sort}
                onSortChange={listQuery.setSort}
                enableRowSelection
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                onPageChange={listQuery.setPage}
                onPageSizeChange={handlePageSizeChange}
                emptyIcon={
                  <Share2 className="h-10 w-10 text-muted-foreground/50" />
                }
                emptyTitle={t('shares.empty.title')}
                emptyDescription={t('shares.empty.description')}
              />
            </TabsContent>

            <TabsContent value="sharedByMe">
              <SharedByMeTable />
            </TabsContent>

            <TabsContent value="people">
              <PeopleAccessView />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <BulkActionBar
        count={tab === 'shares' ? selectedShares.length : 0}
        onClear={clearSelection}
        canDelete={deletableShares.length > 0}
        busy={deleteMutation.isPending}
        onDelete={() => setConfirmBulkDelete(true)}
      />

      {viewing && (
        <ShareDetailSheet
          open
          onOpenChange={(open) => !open && setViewing(null)}
          share={viewing}
          onEdit={() => {
            setEditor({ mode: 'edit', share: viewing })
            setViewing(null)
          }}
          onDelete={() => {
            setToDelete(viewing)
            setViewing(null)
          }}
          onDuplicate={() => {
            setEditor({ mode: 'duplicate', share: viewing })
            setViewing(null)
          }}
        />
      )}

      {editor && (
        <ShareEditorSheet
          open
          onOpenChange={(open) => !open && setEditor(null)}
          mode={editor.mode}
          share={editor.share}
        />
      )}

      <DeleteConfirmationDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        objectName=""
        title={t('shares.bulk.deleteTitle')}
        description={t('shares.bulk.deleteDescription', {
          count: deletableShares.length,
        })}
        confirmLabel={t('shares.deleteAction')}
        onDelete={runBulkDelete}
      />

      <DeleteConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDelete={confirmDelete}
        objectName={toDelete?.name ?? ''}
      />
    </>
  )
}
