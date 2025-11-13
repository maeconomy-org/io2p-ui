'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useObjects } from '@/hooks'

interface ObjectToDelete {
  uuid: string
  name: string
}

export function useUnifiedDelete() {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [objectToDelete, setObjectToDelete] = useState<ObjectToDelete | null>(
    null
  )

  const { useDeleteObject } = useObjects()
  const { mutateAsync: deleteObject, isPending: isDeleting } = useDeleteObject()

  const handleDelete = (object: ObjectToDelete) => {
    setObjectToDelete(object)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!objectToDelete) return

    try {
      toast.loading('Deleting object...', { id: 'delete-object' })

      await deleteObject(objectToDelete.uuid)

      toast.success('Object deleted successfully', { id: 'delete-object' })
      setIsDeleteModalOpen(false)
      setObjectToDelete(null)
    } catch (error) {
      console.error('Error deleting object:', error)
      toast.error('Failed to delete object', { id: 'delete-object' })
    }
  }

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false)
    setObjectToDelete(null)
  }

  return {
    isDeleteModalOpen,
    objectToDelete,
    isDeleting,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
    setIsDeleteModalOpen,
  }
}
