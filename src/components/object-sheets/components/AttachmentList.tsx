'use client'

import type { FileData, Attachment } from '@/types'
import { FileList } from './FileDisplay'

type AttachmentListProps = {
  attachments: Attachment[]
  onRemoveAttachment?: (attachment: Attachment) => void // For removing attachments during creation
  allowHardRemove?: boolean // Allow hard removal (for non-uploaded files)
}

/**
 * Convert Attachment to FileData format for the new FileDisplay component
 */
function attachmentToFileData(attachment: Attachment, index: number): FileData {
  return {
    uuid: attachment.uuid || `temp-${index}`, // Use uuid if available, fallback to index
    fileName: attachment.fileName || '',
    fileReference: attachment.fileReference || attachment.url || '',
    label: attachment.label,
    contentType: attachment.mimeType,
    size: attachment.size,
    softDeleted: attachment.softDeleted,
    softDeletedAt: attachment.softDeletedAt,
  }
}

export function AttachmentList({
  attachments,
  onRemoveAttachment,
  allowHardRemove = false,
}: AttachmentListProps) {
  // Convert attachments to FileData format
  const files: FileData[] = attachments.map((att, index) =>
    attachmentToFileData(att, index)
  )

  // Handle file removal by finding corresponding attachment
  const handleFileRemove = onRemoveAttachment
    ? (file: FileData) => {
        // Find attachment by index first (for newly created files without UUID)
        const fileIndex = files.findIndex(
          (f) =>
            f.fileName === file.fileName &&
            f.contentType === file.contentType &&
            f.size === file.size
        )

        if (fileIndex >= 0 && fileIndex < attachments.length) {
          onRemoveAttachment(attachments[fileIndex])
        } else {
          // Fallback to UUID lookup for existing files
          const attachment = attachments.find(
            (att) => att.fileName === file.fileName && att.uuid === file.uuid
          )
          if (attachment) {
            onRemoveAttachment(attachment)
          }
        }
      }
    : undefined

  return (
    <FileList
      files={files}
      onRemoveFile={handleFileRemove}
      allowHardRemove={allowHardRemove}
      showEmptyState={false}
    />
  )
}
