'use client'

import { useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { Download, Link as LinkIcon, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, Badge } from '@/components/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { useFilesApi } from '@/hooks'
import type { FileData } from '@/types'

import { isExternalFileReference, truncateText } from '../utils'

interface FileDisplayProps {
  file: FileData
  onClick?: (file: FileData) => void
  className?: string
  onRemove?: (file: FileData) => void // Callback for removing file from list
  allowHardRemove?: boolean // Allow hard removal (for non-uploaded files)
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
 * Handle file opening - always use fileReference for both types
 */
function handleFileOpen(file: FileData): void {
  if (file.fileReference) {
    window.open(file.fileReference, '_blank', 'noopener,noreferrer')
  }
}

export function FileDisplay({
  file,
  onClick,
  className,
  onRemove,
  allowHardRemove = false,
}: FileDisplayProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const icon = getFileIcon(file)
  const typeBadge = getFileTypeBadge(file)
  const displayName = getDisplayName(file)
  const isSoftDeleted = file.softDeleted
  const { useSoftDeleteFile } = useFilesApi()
  const softDeleteFile = useSoftDeleteFile()

  const handleClick = () => {
    if (onClick) {
      onClick(file)
    } else {
      handleFileOpen(file)
    }
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
            Deleted
          </Badge>
        )}
        {!isSoftDeleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
            onClick={handleRemoveFile}
            title="Delete file"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Move AlertDialog outside the clickable container */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{displayName}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

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
  return (
    <div className={cn('space-y-1', className)}>
      {files && files.length > 0 ? (
        files.map((file, index) => (
          <FileDisplay
            key={file.uuid || index}
            file={file}
            onRemove={onRemoveFile}
            allowHardRemove={allowHardRemove}
          />
        ))
      ) : showEmptyState ? (
        <p className="text-sm text-muted-foreground">
          No files found for this object
        </p>
      ) : null}
    </div>
  )
}
