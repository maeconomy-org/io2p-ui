'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui'
import type { Attachment } from '@/types'
import { useIomSdkClient } from '@/contexts'
import { useUploadService } from '@/lib/upload-service'
import { logger } from '@/lib'

import { AttachmentSection } from './attachment-section'

type AttachmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void
  title?: string
  allowReference?: boolean
  allowUpload?: boolean
  disabled?: boolean
  // Upload context for background processing
  uploadContext?: {
    objectUuid?: string
    propertyUuid?: string
    valueUuid?: string
  }
  // Callback when uploads complete
  onUploadComplete?: () => void
}

export function AttachmentModal({
  open,
  onOpenChange,
  attachments,
  onChange,
  title,
  allowReference = true,
  allowUpload = true,
  disabled = false,
  uploadContext,
  onUploadComplete,
}: AttachmentModalProps) {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [showUploadConfirm, setShowUploadConfirm] = useState(false)
  const client = useIomSdkClient()
  const uploadService = useUploadService()
  const initialAttachmentsRef = useRef<Attachment[]>([])
  const t = useTranslations('attachmentModal')
  const tCommon = useTranslations('common')

  // Capture initial state only when modal opens (not when attachments change)
  useEffect(() => {
    if (open) {
      initialAttachmentsRef.current = [...attachments]
    }
  }, [open]) // Remove attachments dependency

  // Handle modal close - clear state if user didn't submit
  const handleModalClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset to initial attachments if user closes without submitting
      onChange(initialAttachmentsRef.current)
    }
    onOpenChange(isOpen)
  }

  // Get all uploadable attachments (NEW files only - exclude existing files with UUIDs)
  const getUploadableAttachments = (attachmentList: Attachment[]) => {
    const filtered = attachmentList.filter((att) => {
      // Skip existing files that already have UUIDs (already uploaded/saved)
      if (att.uuid) {
        return false
      }

      // Only include NEW files that need to be uploaded
      const isUploadable =
        (att.mode === 'upload' && att.blob) ||
        (att.mode === 'reference' && (att.url || att.fileReference))

      return isUploadable
    })
    return filtered
  }

  const handleAttachmentChange = (newAttachments: Attachment[]) => {
    // Always just update the state, no immediate uploads
    onChange(newAttachments)
  }

  const handleConfirmUpload = async () => {
    setShowUploadConfirm(false)
    onOpenChange(false) // Close the main modal

    if (!client || !uploadContext) {
      logger.error('Missing client or upload context')
      return
    }

    // Start uploads in background
    const filesToUpload = getUploadableAttachments(pendingAttachments)

    if (filesToUpload.length > 0) {
      // Show upload started message
      toast.loading(t('uploading', { count: filesToUpload.length }), {
        id: 'file-upload',
        description: `⚠️ ${t('uploadDoNotReload')}`,
      })

      try {
        // Start background upload using new interface
        filesToUpload.forEach((attachment) => {
          uploadService.addFile({
            id: `${attachment.fileName}-${Date.now()}`,
            attachment,
            objectUuid: uploadContext.objectUuid,
            propertyUuid: uploadContext.propertyUuid,
            valueUuid: uploadContext.valueUuid,
            status: 'pending',
            progress: 0,
            retries: 0,
          })
        })

        // Poll for completion with timeout
        const maxWaitMs = 60000 // 60 seconds max
        const pollIntervalMs = 1000
        let elapsed = 0

        const checkStatus = () => {
          const status = uploadService.getQueueStatus()
          const completed = status.filter((s) => s.status === 'completed')
          const failed = status.filter((s) => s.status === 'failed')
          const pending = status.filter(
            (s) => s.status === 'pending' || s.status === 'uploading'
          )

          // All done or timed out
          if (pending.length === 0 || elapsed >= maxWaitMs) {
            if (failed.length > 0) {
              toast.error(t('filesFailedToUpload', { count: failed.length }), {
                id: 'file-upload',
              })
            } else if (completed.length > 0) {
              toast.success(
                t('filesUploadedSuccessfully', { count: completed.length }),
                {
                  id: 'file-upload',
                }
              )
            } else if (elapsed >= maxWaitMs) {
              toast.error(t('uploadTimedOut'), { id: 'file-upload' })
            } else {
              // No files processed - dismiss toast
              toast.dismiss('file-upload')
            }
            onUploadComplete?.()
            return
          }

          // Keep polling
          elapsed += pollIntervalMs
          setTimeout(checkStatus, pollIntervalMs)
        }

        // Start polling after initial delay
        setTimeout(checkStatus, pollIntervalMs)
      } catch (error) {
        logger.error('Upload error:', {
          error: error instanceof Error ? error.message : String(error),
        })
        toast.error(t('uploadFailed'), { id: 'file-upload' })
      }
    }

    setPendingAttachments([])
  }

  const handleCancelUpload = () => {
    setShowUploadConfirm(false)
    setPendingAttachments([])
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{title || t('title')}</DialogTitle>
          </DialogHeader>
          <DialogDescription></DialogDescription>

          <AttachmentSection
            attachments={attachments}
            onChange={handleAttachmentChange}
            allowReference={allowReference}
            allowUpload={allowUpload}
            disabled={disabled}
          />

          <DialogFooter>
            <Button
              type="button"
              data-test="attachment-modal-done-button"
              onClick={() => {
                // Check if there are uploadable files
                const uploadableFiles = getUploadableAttachments(attachments)

                if (uploadableFiles.length > 0 && uploadContext) {
                  // Show upload confirmation for any uploadable files
                  setPendingAttachments(attachments)
                  setShowUploadConfirm(true)
                } else {
                  // No files to upload or no upload context, just close
                  onOpenChange(false)
                }
              }}
            >
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Confirmation Dialog */}
      <AlertDialog open={showUploadConfirm} onOpenChange={setShowUploadConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('uploadTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {t('uploadDescription', {
                count: getUploadableAttachments(pendingAttachments).length,
              })}
            </AlertDialogDescription>
            <AlertDialogDescription className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
              ⚠️ <strong>{t('important')}</strong> {t('uploadWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpload}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpload}
              data-test="upload-files-confirm-button"
            >
              {t('uploadFiles')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
