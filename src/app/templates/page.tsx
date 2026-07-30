'use client'

import { useState, useMemo, useCallback } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText, Package, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { CreateTemplateInput, TemplateListItem } from 'io2p-client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
  type OwnerFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { useTemplates } from '@/hooks/api/entities'
import { useAuth, useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/modals'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import { buildTemplateColumns } from './components/template-columns'
import {
  templateTypeSection,
  type TemplateTypeFilterValue,
} from './components/template-type-filter'

// Lazy-load sheet components — only rendered when opened by user interaction
const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
const TemplateSheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.TemplateSheet),
  { ssr: false }
)

export default function TemplatesPage() {
  const t = useTranslations()

  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateListItem | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [typeFilter, setTypeFilter] = useState<TemplateTypeFilterValue>()
  // Which kind a CREATE will be. An edit takes the loaded template's own type.
  const [createType, setCreateType] =
    useState<NonNullable<CreateTemplateInput['type']>>('object')
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [shareTarget, setShareTarget] = useState<TemplateListItem | null>(null)
  const [templateToDelete, setTemplateToDelete] =
    useState<TemplateListItem | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useTemplates()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const { data: templatesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope: 'all',
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
      system: owner,
      type: typeFilter,
    },
    { keepPreviousData: true }
  )

  const handleAddTemplate = useCallback(
    (type: NonNullable<CreateTemplateInput['type']>) => {
      setCreateType(type)
      setSelectedTemplate(null)
      setOpenInEditMode(false)
      setTemplateSheetOpen(true)
    },
    []
  )

  const openTemplate = useCallback(
    (template: TemplateListItem, edit: boolean) => {
      setSelectedTemplate(template)
      setOpenInEditMode(edit)
      setTemplateSheetOpen(true)
    },
    []
  )

  const handleRestoreTemplate = useCallback(
    async (template: TemplateListItem) => {
      try {
        await restoreMutation.mutateAsync({ id: template.id })
        toast.success(t('templates.restored'))
      } catch (error) {
        logger.error('Error restoring template:', error)
        toast.error(t('templates.restoreFailed'))
      }
    },
    [restoreMutation, t]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      listQuery.setPage(1)
    },
    [listQuery]
  )

  const confirmDeleteTemplate = useCallback(async () => {
    if (!templateToDelete) return
    try {
      await removeMutation.mutateAsync({ id: templateToDelete.id })
      toast.success(t('templates.deleted'))
    } catch (error) {
      logger.error('Error deleting template:', error)
      toast.error(t('templates.deleteFailed'))
    } finally {
      setTemplateToDelete(null)
    }
  }, [templateToDelete, removeMutation, t])

  const selectedRows = useMemo(
    () => (templatesPage?.data ?? []).filter((row) => rowSelection[row.id]),
    [templatesPage, rowSelection]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])
  const anyDeleted = selectedRows.some((row) => row.deleted)
  const anyLive = selectedRows.some((row) => !row.deleted)

  // Sequential — a partial failure should stop rather than leave an unknown subset changed.
  const runBulk = useCallback(
    async (action: 'delete' | 'restore') => {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      const targets = selectedRows.filter((row) =>
        action === 'delete' ? !row.deleted : row.deleted
      )
      try {
        for (const row of targets) {
          await mutation.mutateAsync({ id: row.id })
        }
        toast.success(
          t(action === 'delete' ? 'templates.deleted' : 'templates.restored')
        )
      } catch (error) {
        logger.error('Bulk templates failed', error)
        toast.error(
          t(
            action === 'delete'
              ? 'templates.deleteFailed'
              : 'templates.restoreFailed'
          )
        )
      } finally {
        clearSelection()
      }
    },
    [selectedRows, removeMutation, restoreMutation, clearSelection, t]
  )

  const columns = useMemo(
    () =>
      buildTemplateColumns({
        t,
        actions: {
          onViewDetails: (template) => openTemplate(template, false),
          onEdit: (template) => openTemplate(template, true),
          onShare: setShareTarget,
          onDelete: setTemplateToDelete,
          onRestore: handleRestoreTemplate,
        },
      }),
    [t, openTemplate, handleRestoreTemplate]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">{t('templates.title')}</h2>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  templateTypeSection(t, typeFilter, setTypeFilter),
                  ownerSection(t, owner, setOwner),
                  deletedSection(t, showDeleted, setShowDeleted),
                ]}
              />
              {/* One list holds both kinds, so the button has to ask which — the page no longer
                  implies one. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('templates.create')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => handleAddTemplate('object')}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    {t('templates.createObject')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleAddTemplate('process')}
                  >
                    <Workflow className="mr-2 h-4 w-4" />
                    {t('templates.createProcess')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={templatesPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
            />
          )}

          <EntityTable
            columns={columns}
            page={templatesPage}
            getRowId={(template) => template.id}
            fetching={isFetching}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={handlePageSizeChange}
            emptyIcon={
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('templates.noTemplatesTitle')}
            emptyDescription={t('templates.noTemplatesDescription')}
          />
        </div>
      </div>

      {templateSheetOpen && (
        <TemplateSheet
          open={templateSheetOpen}
          onOpenChange={setTemplateSheetOpen}
          templateId={selectedTemplate?.id}
          initialEditing={openInEditMode}
          type={createType}
        />
      )}

      {shareTarget && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          target={{
            type: 'template',
            id: shareTarget.id,
            name: shareTarget.name,
          }}
          isOwner={shareTarget.ownerUserId === userId}
        />
      )}

      <BulkActionBar
        count={selectedRows.length}
        onClear={clearSelection}
        canDelete={anyLive}
        canRestore={anyDeleted}
        busy={removeMutation.isPending || restoreMutation.isPending}
        onDelete={() => setConfirmBulk(true)}
        onRestore={() => runBulk('restore')}
      />

      <DeleteConfirmationDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        objectName=""
        title={t('common.bulk.deleteTitle')}
        description={t('common.bulk.deleteDescription', {
          count: selectedRows.filter((row) => !row.deleted).length,
        })}
        onDelete={() => runBulk('delete')}
      />

      <DeleteConfirmationDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        onDelete={confirmDeleteTemplate}
        objectName={templateToDelete?.name || t('templates.defaultName')}
      />
    </>
  )
}
