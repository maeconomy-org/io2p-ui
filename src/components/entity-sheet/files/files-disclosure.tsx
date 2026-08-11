'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Paperclip } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { isPreviewable } from './file-helpers'
import { FilePreview } from './file-preview'
import { FileRow } from './file-row'

// A collapsible "> Files (N)" block, reused under a value and under a property. Collapsed by default.
// `onAttach` (edit mode) renders a paperclip in the header that opens the attachment modal; the value
// field renders its own in-field paperclip instead, so it omits `onAttach` here.
export function FilesDisclosure({
  files,
  editing,
  entityId,
  onAttach,
  onRemove,
  onChange,
}: {
  files: DraftFile[]
  editing: boolean
  entityId?: string
  onAttach?: () => void
  onRemove?: (localId: string) => void
  onChange?: (
    localId: string,
    patch: Partial<DraftFile>,
    options?: { dirty?: boolean }
  ) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  // Preview lives here rather than in the row so arrow-key navigation can step through the
  // disclosure's other files as siblings.
  const [previewFile, setPreviewFile] = useState<DraftFile | null>(null)

  // Nothing to show and no way to add → render nothing (keeps read-only values compact).
  if (files.length === 0 && !onAttach) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
      <div className="flex items-center gap-1">
        <CollapsibleTrigger
          data-testid="files-count"
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              open && 'rotate-90'
            )}
          />
          {t('objects.files.filesCount', { count: files.length })}
        </CollapsibleTrigger>
        {editing && onAttach && (
          <button
            type="button"
            aria-label={t('objects.files.attach')}
            title={t('objects.files.attach')}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onAttach}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <CollapsibleContent className="space-y-1 pl-1">
        {files.map((f) => (
          <FileRow
            key={f._localId}
            file={f}
            editing={editing}
            entityId={entityId}
            onRemove={onRemove}
            onChange={onChange}
            onPreview={setPreviewFile}
          />
        ))}
      </CollapsibleContent>

      <FilePreview
        file={previewFile}
        siblings={files.filter(isPreviewable)}
        open={previewFile !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewFile(null)
        }}
      />
    </Collapsible>
  )
}
