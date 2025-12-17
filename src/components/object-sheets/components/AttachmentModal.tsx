'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

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
import { getUploadService, logger } from '@/lib'
import { useIomSdkClient } from '@/contexts'

import { AttachmentSection } from './AttachmentSection'

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
  title = 'Manage Attachments',
  allowReference = true,
  allowUpload = true,
  disabled = false,
  uploadContext,
  onUploadComplete,
}: AttachmentModalProps) {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [showUploadConfirm, setShowUploadConfirm] = useState(false)
  const client = useIomSdkClient()
  const initialAttachmentsRef = useRef<Attachment[]>([])

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
      console.error('Missing client or upload context')
      return
    }

    // Start uploads in background
    const uploadService = getUploadService(client)
    const filesToUpload = getUploadableAttachments(pendingAttachments)

    if (filesToUpload.length > 0) {
      // Show upload started message
      toast.loading(`Uploading ${filesToUpload.length} files...`, {
        id: 'file-upload',
        description: '⚠️ Do not reload the page while uploading',
      })

      try {
        // Start background upload
        await uploadService.queueFileUploads(filesToUpload, uploadContext)

        // Wait for completion and show results
        setTimeout(async () => {
          const summary = uploadService.getUploadSummary()

          if (summary.completed.length > 0) {
            toast.success(
              `${summary.completed.length} files uploaded successfully`,
              {
                id: 'file-upload',
              }
            )
          }
          if (summary.failed.length > 0) {
            toast.error(`${summary.failed.length} files failed to upload`, {
              id: 'file-upload',
            })
          }

          uploadService.clearCompleted()
          onUploadComplete?.()
        }, 2000)
      } catch (error) {
        logger.error('Upload error:', {
          error: error instanceof Error ? error.message : String(error),
        })
        toast.error('Upload failed', { id: 'file-upload' })
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
            <DialogTitle>{title}</DialogTitle>
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
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Confirmation Dialog */}
      <AlertDialog open={showUploadConfirm} onOpenChange={setShowUploadConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Files?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {getUploadableAttachments(pendingAttachments).length} file(s) will
              be uploaded and attached. This action cannot be undone.
            </AlertDialogDescription>
            <AlertDialogDescription className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
              ⚠️ <strong>Important:</strong> Do not reload or navigate away from
              this page while files are uploading.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpload}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>
              Upload Files
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
