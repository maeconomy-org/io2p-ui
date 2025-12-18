'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

import type { FileData, Attachment } from '@/types'
import { cn } from '@/lib/utils'
import { Button, Input, Badge } from '@/components/ui'
import { FileList } from './FileDisplay'
import { truncateText } from '../utils'

type AttachmentListProps = {
  attachments: Attachment[]
  onRemoveAttachment?: (attachment: Attachment) => void // For removing attachments during creation
  onRenameAttachment?: (attachment: Attachment, newFileName: string) => void // For renaming during creation
  allowHardRemove?: boolean // Allow hard removal (for non-uploaded files)
  allowRename?: boolean // Allow renaming (only for new uploads without uuid)
}

/**
 * Split filename into name and extension
 */
function splitFileName(fileName: string): { name: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) {
    return { name: fileName, ext: '' }
  }
  return {
    name: fileName.substring(0, lastDot),
    ext: fileName.substring(lastDot), // includes the dot
  }
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
  onRenameAttachment,
  allowHardRemove = false,
  allowRename = false,
}: AttachmentListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editExtension, setEditExtension] = useState('') // Store extension separately

  // Separate new uploads (editable) from existing files
  const newUploads = attachments.filter(
    (att) => !att.uuid && att.mode === 'upload'
  )
  const existingFiles = attachments.filter(
    (att) => att.uuid || att.mode !== 'upload'
  )

  // Convert existing files to FileData format for FileList
  const files: FileData[] = existingFiles.map((att, index) =>
    attachmentToFileData(att, index)
  )

  // Handle file removal by finding corresponding attachment
  const handleFileRemove = onRemoveAttachment
    ? (file: FileData) => {
        const fileIndex = files.findIndex(
          (f) =>
            f.fileName === file.fileName &&
            f.contentType === file.contentType &&
            f.size === file.size
        )

        if (fileIndex >= 0 && fileIndex < existingFiles.length) {
          onRemoveAttachment(existingFiles[fileIndex])
        } else {
          const attachment = existingFiles.find(
            (att) => att.fileName === file.fileName && att.uuid === file.uuid
          )
          if (attachment) {
            onRemoveAttachment(attachment)
          }
        }
      }
    : undefined

  const handleStartEdit = (index: number, currentName: string) => {
    const { name, ext } = splitFileName(currentName)
    setEditingIndex(index)
    setEditValue(name) // Only the name part, without extension
    setEditExtension(ext) // Store extension to add back on save
  }

  const handleConfirmEdit = (attachment: Attachment) => {
    if (editValue.trim() && onRenameAttachment) {
      // Combine edited name with original extension
      const newFileName = editValue.trim() + editExtension
      onRenameAttachment(attachment, newFileName)
    }
    setEditingIndex(null)
    setEditValue('')
    setEditExtension('')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditValue('')
    setEditExtension('')
  }

  return (
    <div className="space-y-1">
      {/* New uploads with rename capability */}
      {newUploads.map((attachment, index) => {
        const isEditing = editingIndex === index
        const displayName = attachment.fileName || 'Unknown file'

        return (
          <div
            key={`new-${index}`}
            className="flex items-center gap-2 p-2 rounded-md border bg-card"
          >
            {isEditing ? (
              <>
                <div className="flex items-center flex-1 gap-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmEdit(attachment)
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                  />
                  {editExtension && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {editExtension}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                  onClick={() => handleConfirmEdit(attachment)}
                  title="Confirm"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleCancelEdit}
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm truncate flex-1">
                  {truncateText(displayName, 50)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  New
                </Badge>
                {allowRename && onRenameAttachment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleStartEdit(index, displayName)}
                    title="Rename file"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {onRemoveAttachment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                    onClick={() => onRemoveAttachment(attachment)}
                    title="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Existing files (references and already uploaded) */}
      {files.length > 0 && (
        <FileList
          files={files}
          onRemoveFile={handleFileRemove}
          allowHardRemove={allowHardRemove}
          showEmptyState={false}
        />
      )}
    </div>
  )
}
