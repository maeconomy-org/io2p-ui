'use client'

import { useState } from 'react'
import { Link as LinkIcon, Upload } from 'lucide-react'

import type { Attachment } from '@/types'
import { FileDropzone, Button, Input, Separator } from '@/components/ui'

import { getMaxUploadSizeMB, isOversize } from '../utils'
import { AttachmentList } from './AttachmentList'

type AttachmentSectionProps = {
  title?: string
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void
  disabled?: boolean
  allowReference?: boolean
  allowUpload?: boolean
}

export function AttachmentSection({
  attachments,
  onChange,
  disabled = false,
  allowReference = true,
  allowUpload = true,
}: AttachmentSectionProps) {
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceLabel, setReferenceLabel] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleAddReference = () => {
    if (!referenceUrl.trim()) return
    const url = referenceUrl.trim()
    const att: Attachment = {
      mode: 'reference',
      fileReference: url,
      label: referenceLabel || url || undefined,
    }
    onChange([...(attachments || []), att])
    setReferenceUrl('')
    setReferenceLabel('')
  }

  const handleDrop = async (files: File[]) => {
    if (!allowUpload || disabled) return
    setError(null)
    const maxMB = getMaxUploadSizeMB()

    setIsUploading(true)
    setUploadProgress(10)

    const accepted: Attachment[] = []
    for (const file of files) {
      if (isOversize(file, maxMB)) {
        setError(`File ${file.name} exceeds max size of ${maxMB}MB`)
        continue
      }
      accepted.push({
        mode: 'upload',
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        blob: file,
      })
    }

    // Simulate progress
    setUploadProgress(60)
    await new Promise((r) => setTimeout(r, 350))
    setUploadProgress(100)
    await new Promise((r) => setTimeout(r, 200))

    if (accepted.length > 0) onChange([...(attachments || []), ...accepted])
    setIsUploading(false)
    setUploadProgress(0)
  }

  const removeAttachment = (index: number) => {
    onChange((attachments || []).filter((_, i) => i !== index))
  }

  const removeAttachmentByObject = (attachment: Attachment) => {
    const index = attachments.findIndex((att) => att === attachment)
    if (index >= 0) {
      removeAttachment(index)
    }
  }

  const renameAttachment = (attachment: Attachment, newFileName: string) => {
    const index = attachments.findIndex((att) => att === attachment)
    if (index >= 0) {
      const updated = [...attachments]
      const oldAttachment = updated[index]

      // Create a new File object with the new filename for multipart upload
      let newBlob = oldAttachment.blob
      if (oldAttachment.blob instanceof File) {
        newBlob = new File([oldAttachment.blob], newFileName, {
          type: oldAttachment.blob.type,
        })
      }

      updated[index] = {
        ...oldAttachment,
        fileName: newFileName,
        blob: newBlob,
      }
      onChange(updated)
    }
  }

  return (
    <div className="space-y-3 py-4">
      {allowUpload && (
        <FileDropzone
          onDrop={handleDrop}
          isLoading={isUploading}
          loadingText={`Uploading... (${uploadProgress}%)`}
          progress={uploadProgress}
          error={error}
          disabled={disabled}
          multiple
          className="py-8"
        >
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5 mb-2" />
            <p className="text-sm">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-sm font-semibold">
              Max {getMaxUploadSizeMB()}MB
            </p>
          </div>
        </FileDropzone>
      )}

      {allowReference && (
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <Input
              placeholder="Enter external file URL"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              disabled={disabled}
            />
          </div>
          <Input
            placeholder="Label (optional)"
            className="max-w-[180px]"
            value={referenceLabel}
            onChange={(e) => setReferenceLabel(e.target.value)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddReference}
            disabled={disabled}
          >
            <LinkIcon className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      )}

      <Separator />

      {(attachments?.length ?? 0) > 0 ? (
        <div className="space-y-2 overflow-y-auto max-h-[200px]">
          <AttachmentList
            attachments={attachments}
            onRemoveAttachment={removeAttachmentByObject}
            onRenameAttachment={renameAttachment}
            allowHardRemove={true}
            allowRename={true}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          No attachments
        </div>
      )}
    </div>
  )
}
