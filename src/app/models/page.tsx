'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'

import { Button, Badge } from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { ObjectModelsTable } from '@/components/tables'
import { useModelData, useUnifiedDelete } from '@/hooks'
import { useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/modals'

// Lazy-load sheet component — only rendered when opened by user interaction
const ObjectModelSheet = dynamic(
  () =>
    import('@/components/object-sheets/object-model-sheet').then(
      (mod) => mod.ObjectModelSheet
    ),
  { ssr: false }
)

export default function ObjectModelsPage() {
  const t = useTranslations()
  // State for UI controls
  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const [selectedModel, setSelectedModel] = useState<any | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  // Use model data hook with pagination and filtering
  const {
    data: models,
    loading,
    fetching,
    pagination,
  } = useModelData({
    showDeleted: showDeleted,
  })

  // Use unified delete hook
  const {
    isDeleteModalOpen,
    objectToDelete,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useUnifiedDelete()

  // Handle opening the sheet for adding a new model
  const handleAddModel = () => {
    setSelectedModel(null)
    setIsEditing(false)
    setSheetOpen(true)
  }

  // Handle opening the sheet for editing an existing model
  const handleEditModel = (model: any) => {
    setSelectedModel(model)
    setIsEditing(true)
    setSheetOpen(true)
  }

  return (
    <>
      <div className="container mx-auto p-4 flex-1">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">{t('models.title')}</h2>
            <div className="flex items-center gap-4">
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
            onDelete={handleDelete}
            loading={loading}
            fetching={fetching}
            pagination={isSearchMode ? undefined : pagination}
          />
        </div>
      </div>

      {/* Sheet for adding/editing models */}
      <ObjectModelSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        model={selectedModel}
        isEditing={isEditing}
      />

      {/* Unified delete confirmation dialog */}
      <DeleteConfirmationDialog
        open={isDeleteModalOpen}
        onOpenChange={handleDeleteCancel}
        onDelete={handleDeleteConfirm}
        objectName={objectToDelete?.name || t('models.defaultName')}
      />
    </>
  )
}
