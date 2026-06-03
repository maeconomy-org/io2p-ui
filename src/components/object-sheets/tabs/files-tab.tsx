'use client'

import { LayoutGrid, List, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { FileData } from '@/types'
import { cn } from '@/lib/utils'
import { usePreference } from '@/hooks'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'

import { FileGridView, FileList } from '../components'

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
  const [viewMode, setViewMode] = usePreference('filesView')

  const fileData = convertApiFilesToFileData(files)
  const hasFiles = fileData.length > 0

  const handleOpenObjectFilesModal = () => {
    setIsObjectFilesModalOpen(true)
  }

  return (
    <div className="space-y-4 py-4">
      {/* Files Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('objects.filesTitle')}
          </h3>
          <div className="flex items-center gap-2">
            {/* View mode toggle — only when there are files to show */}
            {hasFiles && (
              <TooltipProvider>
                <div className="flex items-center overflow-hidden rounded-md border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-testid="files-list-view-toggle"
                        aria-label={t('objects.files.listView')}
                        aria-pressed={viewMode === 'list'}
                        onClick={() => setViewMode('list')}
                        className={cn(
                          'p-1 transition-colors',
                          viewMode === 'list'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('objects.files.listView')}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-testid="files-grid-view-toggle"
                        aria-label={t('objects.files.gridView')}
                        aria-pressed={viewMode === 'grid'}
                        onClick={() => setViewMode('grid')}
                        className={cn(
                          'p-1 transition-colors',
                          viewMode === 'grid'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('objects.files.gridView')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}

            {!isDeleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenObjectFilesModal}
                data-testid="add-files-button"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('objects.addFiles')}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {viewMode === 'grid' ? (
            <FileGridView files={fileData} />
          ) : (
            <FileList files={fileData} />
          )}
        </div>
      </div>
    </div>
  )
}
