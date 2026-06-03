'use client'

import { useState, useRef } from 'react'
import { Link as LinkIcon, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Attachment } from '@/types'
import { FileDropzone, Button, Input, Separator } from '@/components/ui'
import { useAppConfig } from '@/contexts'
import { formatSizeMB } from '@/lib/utils'
import { MAX_FILES_PER_DROP } from '@/constants/limits'

import { isOversize, resolveFileContentType } from '../utils'
import { AttachmentList } from './attachment-list'

type AttachmentSectionProps = {
  title?: string
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void
  disabled?: boolean
  allowReference?: boolean
  allowUpload?: boolean
  hideExisting?: boolean
}

export function AttachmentSection({
  attachments,
  onChange,
  disabled = false,
  allowReference = true,
  allowUpload = true,
  hideExisting = false,
}: AttachmentSectionProps) {
  const t = useTranslations()
  const { maxAttachmentSizeMB } = useAppConfig()
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceLabel, setReferenceLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the latest attachments so async handlers (handleDrop) and
  // synchronous handlers (handleAddReference) that run concurrently don't
  // overwrite each other via stale closures over the `attachments` prop.
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  const handleAddReference = () => {
    if (!referenceUrl.trim()) return
    const url = referenceUrl.trim()
    const att: Attachment = {
      mode: 'reference',
      fileReference: url,
      label: referenceLabel || url || undefined,
    }
    const next = [...(attachmentsRef.current || []), att]
    attachmentsRef.current = next
    onChange(next)
    setReferenceUrl('')
    setReferenceLabel('')
  }

  const handleDrop = (files: File[]) => {
    if (!allowUpload || disabled) return
    setError(null)
    const maxMB = maxAttachmentSizeMB

    // Reject the entire batch on overflow — partial accept hides which files
    // were dropped vs which were silently skipped, and the upload queue can
    // run away on huge multi-selects (e.g., from a folder picker).
    if (files.length > MAX_FILES_PER_DROP) {
      setError(
        t('objects.attachments.tooManyFiles', { max: MAX_FILES_PER_DROP })
      )
      return
    }

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
        mimeType: resolveFileContentType(file),
        blob: file,
      })
    }

    if (accepted.length > 0) {
      const next = [...(attachmentsRef.current || []), ...accepted]
      attachmentsRef.current = next
      onChange(next)
    }
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
          error={error}
          disabled={disabled}
          multiple
          className="py-8"
          dataTestId="attachment-section-dropzone"
        >
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5 mb-2" />
            <p className="text-sm">{t('objects.attachments.dragDrop')}</p>
            <p className="text-sm font-semibold">
              {t('objects.attachments.maxSize', {
                size: formatSizeMB(maxAttachmentSizeMB),
              })}
            </p>
          </div>
        </FileDropzone>
      )}

      {allowReference && (
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <Input
              placeholder={t('objects.attachments.externalUrl')}
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              disabled={disabled}
            />
          </div>
          <Input
            placeholder={t('objects.attachments.labelOptional')}
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
            data-testid="add-reference-button"
          >
            <LinkIcon className="h-4 w-4 mr-1" /> {t('common.add')}
          </Button>
        </div>
      )}

      <Separator />

      {(() => {
        const visibleCount = hideExisting
          ? (attachments ?? []).filter((att) => !att.uuid).length
          : (attachments?.length ?? 0)

        return visibleCount > 0 ? (
          <div className="space-y-2 overflow-y-auto max-h-[200px]">
            <AttachmentList
              attachments={attachments}
              onRemoveAttachment={removeAttachmentByObject}
              onRenameAttachment={renameAttachment}
              allowHardRemove={true}
              allowRename={true}
              hideExisting={hideExisting}
            />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            {t('objects.attachments.noAttachments')}
          </div>
        )
      })()}
    </div>
  )
}
