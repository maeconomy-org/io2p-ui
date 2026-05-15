'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Search, X, HelpCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { UUMathFormulaDTO } from 'iom-sdk'

import {
  Badge,
  Button,
  GridPagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { ObjectModelsTable, FormulasTable } from '@/components/tables'
import { useModelData, useUnifiedDelete, useMathFormulas } from '@/hooks'
import { useFormulaData } from '@/hooks/data/use-formula-data'
import { useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/modals'
import { logger } from '@/lib'

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
  const [selectedModel, setSelectedModel] = useState<any | null>(null)
  const [isEditingModel, setIsEditingModel] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  const {
    data: models,
    loading: modelsLoading,
    fetching: modelsFetching,
    pagination,
  } = useModelData({ showDeleted })

  // Unified delete for models
  const {
    isDeleteModalOpen: isModelDeleteOpen,
    objectToDelete: modelToDelete,
    handleDelete: handleModelDelete,
    handleDeleteConfirm: handleModelDeleteConfirm,
    handleDeleteCancel: handleModelDeleteCancel,
  } = useUnifiedDelete()

  const handleAddModel = () => {
    setSelectedModel(null)
    setIsEditingModel(false)
    setModelSheetOpen(true)
  }

  const handleEditModel = (model: any) => {
    setSelectedModel(model)
    setIsEditingModel(true)
    setModelSheetOpen(true)
  }

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
      <div className="container mx-auto p-4 flex-1">
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
              <div className="flex justify-end items-center gap-2">
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

              {/* Search Mode Indicator */}
              {isSearchMode && (
                <div className="p-3 bg-muted/50 border border-border rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {t('models.searchResults', {
                            query: searchQuery || '...',
                          })}
                        </span>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {searchPagination
                          ? t('models.resultsPage', {
                              count: searchPagination.totalElements,
                              page: searchPagination.currentPage + 1,
                              pages: searchPagination.totalPages,
                            })
                          : t('models.results', {
                              count: searchViewResults.length,
                            })}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSearch}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('models.clearSearch')}
                    </Button>
                  </div>
                </div>
              )}

              <ObjectModelsTable
                models={isSearchMode ? searchViewResults : models}
                onEdit={handleEditModel}
                onDelete={handleModelDelete}
                loading={modelsLoading}
                fetching={modelsFetching}
                pagination={isSearchMode ? undefined : pagination}
              />
            </TabsContent>

            {/* Formulas Tab */}
            <TabsContent value="formulas" className="space-y-4">
              <div className="flex justify-end items-center gap-2">
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
      <ObjectModelSheet
        open={modelSheetOpen}
        onOpenChange={setModelSheetOpen}
        model={selectedModel}
        isEditing={isEditingModel}
      />

      {/* Formula Sheet */}
      <FormulaSheet
        open={formulaSheetOpen}
        onOpenChange={setFormulaSheetOpen}
        formula={selectedFormula}
        isEditing={isEditingFormula}
      />

      {/* Model Delete Confirmation */}
      <DeleteConfirmationDialog
        open={isModelDeleteOpen}
        onOpenChange={handleModelDeleteCancel}
        onDelete={handleModelDeleteConfirm}
        objectName={modelToDelete?.name || t('models.defaultName')}
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
