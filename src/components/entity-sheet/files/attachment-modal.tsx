'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link as LinkIcon, Upload, X } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FileDropzone,
  Input,
} from '@/components/ui'
import { useAppConfig } from '@/contexts'
import { isAllowedExternalFileReference } from '@/lib/validations'
import { formatBytes } from '@/lib/utils'
import { MAX_FILES_PER_DROP } from '@/constants/limits'
import type { DraftFile } from '@/lib/entity'

import {
  fileDisplayName,
  newReferenceDraft,
  newUploadDraft,
  splitFileName,
} from './file-helpers'

// Deferred pick-or-reference. Picks/refs accumulate locally; "Done" hands the batch to `onAdd` (which
// appends to the target's draft `files`). NOTHING uploads here — bytes go up lazily at Save (§18).
export function AttachmentModal({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (files: DraftFile[]) => void
}) {
  const t = useTranslations()
  const { maxAttachmentSizeMB } = useAppConfig()
  const [pending, setPending] = useState<DraftFile[]>([])
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Rename before upload. The extension is kept out of the editable text so it can't be dropped or
  // mangled — the SDK is given an explicit fileName, so nothing has to rebuild the File.
  const renamePending = (localId: string, stem: string) =>
    setPending((current) =>
      current.map((f) => {
        if (f._localId !== localId) return f
        const { ext } = splitFileName(f.fileName ?? f.blob?.name ?? '')
        return { ...f, fileName: `${stem.trim() || 'file'}${ext}` }
      })
    )

  const reset = () => {
    setPending([])
    setUrl('')
    setLabel('')
    setError(null)
  }

  const close = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const onDrop = (accepted: File[]) => {
    setError(null)
    if (accepted.length > MAX_FILES_PER_DROP) {
      setError(
        t('objects.attachments.tooManyFiles', { max: MAX_FILES_PER_DROP })
      )
      return
    }
    const maxBytes = maxAttachmentSizeMB * 1024 * 1024
    const tooBig = accepted.filter((f) => f.size > maxBytes)
    if (tooBig.length > 0) {
      setError(
        t('objects.attachments.dropzoneOversize', {
          names: tooBig.map((f) => f.name).join(', '),
          size: maxAttachmentSizeMB,
        })
      )
    }
    const ok = accepted.filter((f) => f.size <= maxBytes)
    if (ok.length) setPending((prev) => [...prev, ...ok.map(newUploadDraft)])
  }

  const addReference = () => {
    const trimmed = url.trim()
    if (!isAllowedExternalFileReference(trimmed)) {
      setError(t('objects.files.invalidUrl'))
      return
    }
    setError(null)
    setPending((prev) => [...prev, newReferenceDraft(trimmed, label)])
    setUrl('')
    setLabel('')
  }

  const removePending = (localId: string) =>
    setPending((prev) => prev.filter((f) => f._localId !== localId))

  const done = () => {
    if (pending.length) onAdd(pending)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="sm:max-w-[560px]"
        data-testid="attachment-modal"
      >
        <DialogHeader>
          <DialogTitle>{t('objects.files.addFiles')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('objects.files.addFiles')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FileDropzone
            onDrop={onDrop}
            multiple
            className="py-8"
            dataTestId="attachment-modal-dropzone"
          >
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Upload className="mb-2 h-5 w-5" />
              <p className="text-sm">{t('objects.attachments.dragDrop')}</p>
              <p className="text-xs">
                {t('objects.attachments.maxSize', {
                  size: `${maxAttachmentSizeMB}MB`,
                })}
              </p>
            </div>
          </FileDropzone>

          <div className="flex items-end gap-2">
            <Input
              data-testid="attachment-modal-url"
              placeholder={t('objects.attachments.externalUrl')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Input
              data-testid="attachment-modal-label"
              placeholder={t('objects.attachments.labelOptional')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="max-w-[160px]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addReference}
              disabled={!url.trim()}
              data-testid="attachment-modal-add-reference"
            >
              <LinkIcon className="mr-1 h-4 w-4" />
              {t('common.add')}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {pending.length > 0 && (
            <div className="max-h-[180px] space-y-1 overflow-y-auto">
              {pending.map((f) => (
                <div
                  key={f._localId}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
                >
                  {f.kind === 'reference' ? (
                    <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {f.kind === 'upload' ? (
                    <PendingName
                      name={f.fileName ?? f.blob?.name ?? ''}
                      onRename={(next) => renamePending(f._localId, next)}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate">
                      {fileDisplayName(f)}
                    </span>
                  )}
                  {f.kind === 'upload' && f.blob && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(f.blob.size)}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t('common.remove')}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => removePending(f._localId)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={done}
            disabled={pending.length === 0}
            data-testid="attachment-modal-done"
          >
            {t('common.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The stem is editable; the extension rides along as a static suffix. */
function PendingName({
  name,
  onRename,
}: {
  name: string
  onRename: (stem: string) => void
}) {
  const t = useTranslations()
  const { stem, ext } = splitFileName(name)
  return (
    <span className="flex min-w-0 flex-1 items-center">
      <Input
        value={stem}
        aria-label={t('objects.attachments.rename')}
        onChange={(e) => onRename(e.target.value)}
        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
      />
      {ext && <span className="shrink-0 text-muted-foreground">{ext}</span>}
    </span>
  )
}
