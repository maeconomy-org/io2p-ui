'use client'

import { memo, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import dynamic from 'next/dynamic'
import { Download, Link as LinkIcon, Trash2, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  Button,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui'

import { useFilesApi } from '@/hooks'
import type { FileData } from '@/types'
import { detectMimeType, detectPreviewKind, logger, truncateText } from '@/lib'
import { useIomSdkClient } from '@/contexts'
import { downloadFileToClient, extractFileUuid } from '@/components/attachments'

const AttachmentPreview = dynamic(
  () => import('@/components/attachments').then((m) => m.AttachmentPreview),
  { ssr: false }
)

import { isExternalFileReference } from '../utils'

function isPreviewableFile(file: FileData): boolean {
  return (
    detectPreviewKind(detectMimeType(file)) !== 'unsupported' &&
    !isExternalFileReference(file.fileReference)
  )
}

interface FileDisplayProps {
  file: FileData
  onClick?: (file: FileData) => void
  onPreview?: (file: FileData) => void
  className?: string
  onRemove?: (file: FileData) => void
  allowHardRemove?: boolean
}

/**
 * Get appropriate icon based on file type and reference type
 */
function getFileIcon(file: FileData): ReactElement {
  const { fileReference } = file
  const iconSize = 'h-4 w-4'

  // Check if it's an external reference using domain detection
  const isExternal = isExternalFileReference(fileReference)

  // For external references, show link icon
  if (isExternal) {
    return <LinkIcon className={`${iconSize} text-blue-600`} />
  }

  // Default to download icon for direct uploads
  return <Download className={`${iconSize} text-green-600`} />
}

/**
 * Get file type badge text
 */
function getFileTypeBadge(file: FileData): string {
  const { fileReference } = file

  // Use the updated domain detection
  const isExternal = isExternalFileReference(fileReference)
  return isExternal ? 'Reference' : 'File'
}

/**
 * Get display name - for references use label, for uploads use fileName
 */
function getDisplayName(file: FileData): string {
  const { fileName, label, fileReference } = file

  // Use the updated domain detection
  const isExternal = isExternalFileReference(fileReference)

  if (isExternal) {
    // For external references, prefer label, fallback to fileName
    return label || fileName
  } else {
    // For direct uploads, prefer fileName, fallback to label
    return fileName || label || 'Unknown file'
  }
}

/**
 * Download an internal file via the SDK (JWT attached automatically), then
 * trigger the browser download through a blob URL. External references open
 * directly in a new tab.
 */
async function handleFileOpen(
  file: FileData,
  client: ReturnType<typeof useIomSdkClient>
): Promise<void> {
  if (!file.fileReference) return

  if (isExternalFileReference(file.fileReference)) {
    window.open(file.fileReference, '_blank', 'noopener,noreferrer')
    return
  }

  const uuid = extractFileUuid(file.fileReference)
  if (!uuid) {
    logger.error('Could not extract UUID from fileReference', {
      fileReference: file.fileReference,
    })
    return
  }

  try {
    await downloadFileToClient(
      client,
      uuid,
      file.contentType || 'application/octet-stream',
      getDisplayName(file)
    )
  } catch (error) {
    logger.error('Failed to open file', { error })
  }
}

export const FileDisplay = memo(function FileDisplay({
  file,
  onClick,
  onPreview,
  className,
  onRemove,
  allowHardRemove = false,
}: FileDisplayProps) {
  const t = useTranslations()
  const client = useIomSdkClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const icon = getFileIcon(file)
  const typeBadge = getFileTypeBadge(file)
  const displayName = getDisplayName(file)
  const isSoftDeleted = file.softDeleted
  const canPreview = isPreviewableFile(file)
  const { useSoftDeleteFile } = useFilesApi()
  const softDeleteFile = useSoftDeleteFile()

  const handleClick = () => {
    if (onClick) {
      onClick(file)
    } else if (canPreview && onPreview) {
      onPreview(file)
    } else {
      handleFileOpen(file, client)
    }
  }

  const handlePreview = (e: MouseEvent) => {
    e.stopPropagation()
    onPreview?.(file)
  }

  const handleRemoveFile = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (allowHardRemove) {
      // Hard remove from array (for non-uploaded files)
      onRemove?.(file)
    } else {
      // Show confirmation for soft delete (uploaded files)
      setShowDeleteConfirm(true)
    }
  }

  const handleConfirmDelete = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    softDeleteFile.mutate(file.uuid)
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-md border transition-colors',
          isSoftDeleted
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-card hover:bg-accent cursor-pointer',
          className
        )}
        onClick={!isSoftDeleted ? handleClick : undefined}
      >
        {icon}
        <span
          className={cn(
            'text-sm truncate flex-1',
            isSoftDeleted && 'line-through text-destructive'
          )}
        >
          {truncateText(displayName, 50)}
        </span>
        <Badge variant="secondary" className="text-xs">
          {typeBadge}
        </Badge>
        {isSoftDeleted && (
          <Badge
            variant="outline"
            className="text-xs border-destructive text-destructive"
          >
            {t('common.deleted')}
          </Badge>
        )}
        {!isSoftDeleted && canPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
            onClick={handlePreview}
            title={t('objects.files.preview')}
            data-testid={`file-preview-${file.uuid || displayName}`}
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        {!isSoftDeleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
            onClick={handleRemoveFile}
            title={t('objects.files.delete')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('objects.files.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('objects.files.deleteConfirm', { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

/**
 * Display multiple files in a list
 */
interface FileListProps {
  files: FileData[]
  className?: string
  onRemoveFile?: (file: FileData) => void // Callback for removing file from list
  allowHardRemove?: boolean // Allow hard removal (for non-uploaded files)
  showEmptyState?: boolean // Show empty state if no files are found
}

export function FileList({
  files,
  className,
  onRemoveFile,
  allowHardRemove = false,
  showEmptyState = true,
}: FileListProps) {
  const t = useTranslations()
  const [previewFile, setPreviewFile] = useState<FileData | null>(null)

  const previewableSiblings = (files ?? []).filter(isPreviewableFile)

  return (
    <div className={cn('space-y-1', className)}>
      {files && files.length > 0 ? (
        files.map((file, index) => (
          <FileDisplay
            key={file.uuid || index}
            file={file}
            onPreview={setPreviewFile}
            onRemove={onRemoveFile}
            allowHardRemove={allowHardRemove}
          />
        ))
      ) : showEmptyState ? (
        <p className="text-sm text-muted-foreground">
          {t('objects.files.noFiles')}
        </p>
      ) : null}

      <AttachmentPreview
        file={previewFile}
        siblings={previewableSiblings}
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </div>
  )
}
