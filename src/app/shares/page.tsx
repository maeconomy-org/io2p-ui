'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useShares } from '@/hooks/api/access'
import { useSearch } from '@/contexts'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import { buildShareColumns } from './components/share-columns'
import { SharedByMeTable } from './components/shared-by-me-table'

export default function SharesPage() {
  const t = useTranslations()

  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [toDelete, setToDelete] = useState<ShareDTO | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  // Controlled, so the Filters button can be shown only for the tab it filters.
  const [tab, setTab] = useState('shares')

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

  const columns = useMemo(
    () =>
      buildShareColumns({
        t,
        actions: {
          // The editor lands in the next slice; the row currently opens nothing.
          onEdit: () => {},
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
              <h2 className="text-2xl font-semibold">{t('shares.title')}</h2>
              <div className="flex items-center gap-2">
                <TabsList>
                  <TabsTrigger value="shares">
                    {t('shares.tabShares')}
                  </TabsTrigger>
                  <TabsTrigger value="sharedByMe">
                    {t('shares.tabSharedByMe')}
                  </TabsTrigger>
                </TabsList>
                {/* Only the Shares list is filterable — `/access/shared-by-me` takes no filters
                    at all, so showing the control on that tab would offer something inert. */}
                {tab === 'shares' && (
                  <FilterMenu
                    sections={[deletedSection(t, showDeleted, setShowDeleted)]}
                  />
                )}
                <Button size="sm" disabled>
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
                />
              )}

              <EntityTable
                columns={columns}
                page={sharesPage}
                getRowId={(share) => share.id}
                fetching={isFetching}
                sort={listQuery.query.sort}
                onSortChange={listQuery.setSort}
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
          </Tabs>
        </div>
      </div>

      <DeleteConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDelete={confirmDelete}
        objectName={toDelete?.name ?? ''}
      />
    </>
  )
}
