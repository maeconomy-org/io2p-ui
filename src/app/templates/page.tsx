'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { TemplateDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import {
  DeletedFilter,
  OwnerFilter,
  type OwnerFilterValue,
} from '@/components/filters'
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { useTemplates } from '@/hooks/api/entities'
import { useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/modals'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import { buildTemplateColumns } from './components/template-columns'

// Lazy-load sheet components — only rendered when opened by user interaction
const TemplateSheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.TemplateSheet),
  { ssr: false }
)

export default function TemplatesPage() {
  const t = useTranslations()

  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDTO | null>(
    null
  )
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateDTO | null>(
    null
  )

  const { isSearchMode, searchQuery, clearSearch } = useSearch()

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
    },
    { keepPreviousData: true }
  )

  const handleAddTemplate = useCallback(() => {
    setSelectedTemplate(null)
    setOpenInEditMode(false)
    setTemplateSheetOpen(true)
  }, [])

  const openTemplate = useCallback((template: TemplateDTO, edit: boolean) => {
    setSelectedTemplate(template)
    setOpenInEditMode(edit)
    setTemplateSheetOpen(true)
  }, [])

  const handleRestoreTemplate = useCallback(
    async (template: TemplateDTO) => {
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

  const columns = useMemo(
    () =>
      buildTemplateColumns({
        t,
        actions: {
          onViewDetails: (template) => openTemplate(template, false),
          onEdit: (template) => openTemplate(template, true),
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
              <OwnerFilter value={owner} onChange={setOwner} />
              <DeletedFilter
                showDeleted={showDeleted}
                onShowDeletedChange={setShowDeleted}
                label={t('templates.showDeleted')}
              />
              <Button size="sm" onClick={handleAddTemplate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('templates.create')}
              </Button>
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
        />
      )}

      <DeleteConfirmationDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        onDelete={confirmDeleteTemplate}
        objectName={templateToDelete?.name || t('templates.defaultName')}
      />
    </>
  )
}
