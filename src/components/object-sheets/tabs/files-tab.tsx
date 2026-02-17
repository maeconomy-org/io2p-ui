'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { FileData } from '@/types'
import { Button } from '@/components/ui'
import { FileList } from '../components'

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
  files: any[]
  setIsObjectFilesModalOpen: (open: boolean) => void
  isDeleted?: boolean
}

export function FilesTab({
  files,
  setIsObjectFilesModalOpen,
  isDeleted,
}: FilesTabProps) {
  const t = useTranslations()
  const handleOpenObjectFilesModal = () => {
    setIsObjectFilesModalOpen(true)
  }

  return (
    <div className="space-y-4 py-4">
      {/* Files Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('objects.filesTitle')}
          </h3>
          {!isDeleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenObjectFilesModal}
              data-testid="add-files-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('objects.addFiles')}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <FileList files={convertApiFilesToFileData(files)} />
        </div>
      </div>
    </div>
  )
}
