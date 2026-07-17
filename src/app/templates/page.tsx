'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, HelpCircle, FileText } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { UUMathFormulaDTO } from 'iom-sdk'
import type { TemplateDTO } from 'io2p-client'

import {
  Button,
  GridPagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import {
  FormulasTable,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { useMathFormulas } from '@/hooks'
import { useTemplates } from '@/hooks/api/entities'
import { useFormulaData } from '@/hooks/data/use-formula-data'
import { useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/modals'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import { buildTemplateColumns } from './components/template-columns'

// Lazy-load sheet components — only rendered when opened by user interaction
const ObjectModelSheet = dynamic(
  () =>
    import('@/components/object-sheets/object-model-sheet').then(
      (mod) => mod.ObjectModelSheet
    ),
  { ssr: false }
)

const FormulaSheet = dynamic(
  () =>
    import('@/components/formulas/formula-sheet').then(
      (mod) => mod.FormulaSheet
    ),
  { ssr: false }
)

const FormulaReferenceDialog = dynamic(
  () =>
    import('@/components/formulas/formula-reference-dialog').then(
      (mod) => mod.FormulaReferenceDialog
    ),
  { ssr: false }
)

export default function TemplatesPage() {
  const t = useTranslations()

  // --- Object Templates state ---
  const [modelSheetOpen, setModelSheetOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<TemplateDTO | null>(null)
  const [isEditingModel, setIsEditingModel] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateDTO | null>(
    null
  )

  const { isSearchMode, searchQuery, clearSearch } = useSearch()

  const listQuery = useEntityListQuery()
  const { useList, useRemove } = useTemplates()
  const removeMutation = useRemove()
  const { data: templatesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope: 'all',
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
    },
    { keepPreviousData: true }
  )

  const handleAddModel = useCallback(() => {
    setSelectedModel(null)
    setIsEditingModel(false)
    setModelSheetOpen(true)
  }, [])

  const handleEditModel = useCallback((template: TemplateDTO) => {
    setSelectedModel(template)
    setIsEditingModel(true)
    setModelSheetOpen(true)
  }, [])

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      listQuery.setPage(1)
    },
    [listQuery]
  )

  const confirmDeleteModel = useCallback(async () => {
    if (!templateToDelete) return
    try {
      await removeMutation.mutateAsync({ id: templateToDelete.id })
      toast.success(t('models.deleted'))
    } catch (error) {
      logger.error('Error deleting template:', error)
      toast.error(t('models.deleteFailed'))
    } finally {
      setTemplateToDelete(null)
    }
  }, [templateToDelete, removeMutation, t])

  const columns = useMemo(
    () =>
      buildTemplateColumns({
        t,
        actions: { onEdit: handleEditModel, onDelete: setTemplateToDelete },
      }),
    [t, handleEditModel]
  )

  // --- Formulas state ---
  const [formulaReferenceOpen, setFormulaReferenceOpen] = useState(false)
  const [formulaSheetOpen, setFormulaSheetOpen] = useState(false)
  const [selectedFormula, setSelectedFormula] =
    useState<UUMathFormulaDTO | null>(null)
  const [isEditingFormula, setIsEditingFormula] = useState(false)
  const [formulaDeleteOpen, setFormulaDeleteOpen] = useState(false)
  const [formulaToDelete, setFormulaToDelete] = useState<{
    uuid: string
    name: string
  } | null>(null)

  const FORMULAS_PER_PAGE = 12
  const [formulasPage, setFormulasPage] = useState(1)
  const {
    data: formulas,
    totalPages: formulasTotalPages,
    totalElements: formulasTotalElements,
    loading: formulasLoading,
    fetching: formulasFetching,
  } = useFormulaData({
    page: formulasPage - 1,
    pageSize: FORMULAS_PER_PAGE,
  })
  const { useDeleteFormula } = useMathFormulas()
  const deleteFormulaMutation = useDeleteFormula()

  const handleAddFormula = () => {
    setSelectedFormula(null)
    setIsEditingFormula(false)
    setFormulaSheetOpen(true)
  }

  const handleEditFormula = (formula: UUMathFormulaDTO) => {
    setSelectedFormula(formula)
    setIsEditingFormula(true)
    setFormulaSheetOpen(true)
  }

  const handleFormulaDelete = (formula: { uuid: string; name: string }) => {
    setFormulaToDelete(formula)
    setFormulaDeleteOpen(true)
  }

  const handleFormulaDeleteConfirm = async () => {
    if (!formulaToDelete) return
    try {
      await deleteFormulaMutation.mutateAsync(formulaToDelete.uuid)
      toast.success(t('formulas.deleted'))
    } catch (error) {
      logger.error('Error deleting formula:', error)
      toast.error(t('formulas.deleteFailed'))
    } finally {
      setFormulaDeleteOpen(false)
      setFormulaToDelete(null)
    }
  }

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <Tabs defaultValue="object-templates">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{t('models.title')}</h2>
              <TabsList className="w-fit">
                <TabsTrigger value="object-templates">
                  {t('models.tabObjectTemplates')}
                </TabsTrigger>
                <TabsTrigger value="formulas">
                  {t('models.tabFormulas')}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Object Templates Tab */}
            <TabsContent value="object-templates" className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                <DeletedFilter
                  showDeleted={showDeleted}
                  onShowDeletedChange={setShowDeleted}
                  label={t('models.showDeleted')}
                />
                <Button size="sm" onClick={handleAddModel}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('models.create')}
                </Button>
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
                emptyTitle={t('models.noTemplatesTitle')}
                emptyDescription={t('models.noTemplatesDescription')}
              />
            </TabsContent>

            {/* Formulas Tab */}
            <TabsContent value="formulas" className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormulaReferenceOpen(true)}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  {t('formulas.reference.title')}
                </Button>
                <Button size="sm" onClick={handleAddFormula}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('formulas.create')}
                </Button>
              </div>

              <FormulasTable
                formulas={formulas}
                onEdit={handleEditFormula}
                onDelete={handleFormulaDelete}
                loading={formulasLoading}
                fetching={formulasFetching}
              />

              <GridPagination
                currentPage={formulasPage}
                totalPages={formulasTotalPages}
                totalElements={formulasTotalElements}
                pageSize={FORMULAS_PER_PAGE}
                isFetching={formulasFetching}
                onPageChange={setFormulasPage}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Object Model Sheet */}
      {/* Transitional: this sheet types on the pre-io2p ObjectModel and can't consume a
          TemplateDTO — create/edit is rebuilt as the shared EntitySheet in §13. */}
      <ObjectModelSheet
        open={modelSheetOpen}
        onOpenChange={setModelSheetOpen}
        model={selectedModel as never}
        isEditing={isEditingModel}
      />

      {/* Formula Sheet */}
      <FormulaSheet
        open={formulaSheetOpen}
        onOpenChange={setFormulaSheetOpen}
        formula={selectedFormula}
        isEditing={isEditingFormula}
      />

      {/* Template Delete Confirmation */}
      <DeleteConfirmationDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        onDelete={confirmDeleteModel}
        objectName={templateToDelete?.name || t('models.defaultName')}
      />

      {/* Formula Delete Confirmation */}
      <DeleteConfirmationDialog
        open={formulaDeleteOpen}
        onOpenChange={() => {
          setFormulaDeleteOpen(false)
          setFormulaToDelete(null)
        }}
        onDelete={handleFormulaDeleteConfirm}
        objectName={formulaToDelete?.name || t('formulas.defaultName')}
      />

      {/* Formula Reference Dialog */}
      <FormulaReferenceDialog
        open={formulaReferenceOpen}
        onOpenChange={setFormulaReferenceOpen}
      />
    </>
  )
}
