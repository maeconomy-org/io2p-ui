'use client'

import { Plus } from 'lucide-react'

import type { FileData, Attachment } from '@/types'
import { Button, Label } from '@/components/ui'
import { AttachmentModal, FileList } from '../components'

// Helper function to convert API files to FileData format
const convertApiFilesToFileData = (files: any[]): FileData[] => {
  if (!files) return []
  return files.map((file: any) => ({
    uuid: file.uuid,
    fileName: file.fileName,
    fileReference: file.fileReference,
    label: file.label,
    contentType: file.contentType,
    size: file.size,
    softDeleted: file.softDeleted,
    softDeletedAt: file.softDeletedAt,
  }))
}

interface FilesTabProps {
  object?: any
  files: any[]
  objectFiles: Attachment[]
  setObjectFiles: (files: Attachment[]) => void
  isObjectFilesModalOpen: boolean
  setIsObjectFilesModalOpen: (open: boolean) => void
  onUploadComplete: () => void
  isDeleted?: boolean
}

export function FilesTab({
  object,
  files,
  objectFiles,
  setObjectFiles,
  isObjectFilesModalOpen,
  setIsObjectFilesModalOpen,
  onUploadComplete,
  isDeleted,
}: FilesTabProps) {
  const handleOpenObjectFilesModal = () => {
    setIsObjectFilesModalOpen(true)
  }

  const handleObjectFilesChange = (newAttachments: Attachment[]) => {
    setObjectFiles(newAttachments)
  }

  return (
    <div className="space-y-4 py-4">
      {/* Files Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Object Files
          </h3>
          {!isDeleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenObjectFilesModal}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Files
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <FileList files={convertApiFilesToFileData(files)} />
        </div>
      </div>

      {/* Object Files Attachment Modal */}
      <AttachmentModal
        open={isObjectFilesModalOpen}
        onOpenChange={setIsObjectFilesModalOpen}
        attachments={objectFiles}
        onChange={handleObjectFilesChange}
        title="Object Files"
        uploadContext={{
          objectUuid: object?.uuid,
        }}
        onUploadComplete={onUploadComplete}
      />
    </div>
  )
}
