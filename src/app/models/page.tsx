'use client'

import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { Button, DeletedFilter } from '@/components/ui'
import { ObjectModelsTable } from '@/components/tables'
import { ObjectModelSheet } from '@/components/object-sheets'
import { useModelData, useUnifiedDelete } from '@/hooks'
import { DeleteConfirmationDialog } from '@/components/modals'

export default function ObjectModelsPage() {
  // State for UI controls
  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const [selectedModel, setSelectedModel] = useState<any | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

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
            <h2 className="text-2xl font-semibold">Models</h2>
            <div className="flex items-center gap-4">
              <DeletedFilter
                showDeleted={showDeleted}
                onShowDeletedChange={setShowDeleted}
                label="Show deleted items"
              />
              <Button onClick={handleAddModel}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Model
              </Button>
            </div>
          </div>

          <ObjectModelsTable
            models={models}
            onEdit={handleEditModel}
            onDelete={handleDelete}
            loading={loading}
            fetching={fetching}
            pagination={pagination}
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
        objectName={objectToDelete?.name || 'Model'}
      />
    </>
  )
}
