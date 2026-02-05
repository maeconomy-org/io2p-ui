'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { useObjects } from '@/hooks'

interface ObjectToDelete {
  uuid: string
  name: string
}

export function useUnifiedDelete() {
  const t = useTranslations()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [objectToDelete, setObjectToDelete] = useState<ObjectToDelete | null>(
    null
  )
  const [wasDeleteSuccessful, setWasDeleteSuccessful] = useState(false)

  const { useDeleteObject } = useObjects()
  const { mutateAsync: deleteObject, isPending: isDeleting } = useDeleteObject()

  const handleDelete = (object: ObjectToDelete) => {
    setObjectToDelete(object)
    setIsDeleteModalOpen(true)
    setWasDeleteSuccessful(false)
  }

  const handleDeleteConfirm = async () => {
    if (!objectToDelete) return

    try {
      toast.loading(t('objects.deletingObject'), { id: 'delete-object' })

      await deleteObject(objectToDelete.uuid)

      toast.success(t('objects.objectDeletedSuccess'), { id: 'delete-object' })
      setIsDeleteModalOpen(false)
      setObjectToDelete(null)
      setWasDeleteSuccessful(true)
    } catch (error) {
      logger.error('Error deleting object:', error)
      toast.error(t('objects.objectDeleteFailed'), { id: 'delete-object' })
    }
  }

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false)
    setObjectToDelete(null)
  }

  const resetDeleteSuccess = () => {
    setWasDeleteSuccessful(false)
  }

  return {
    isDeleteModalOpen,
    objectToDelete,
    isDeleting,
    wasDeleteSuccessful,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
    resetDeleteSuccess,
    setIsDeleteModalOpen,
  }
}
