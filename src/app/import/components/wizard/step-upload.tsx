'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'

import { Alert, AlertDescription, Progress } from '@/components/ui'
import { anchor } from '@/constants'
import { cn } from '@/lib/utils'
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'
import { useAppConfig } from '@/contexts/query-context'

/**
 * Limits are stated INSIDE the dropzone rather than in a permanent banner above the wizard.
 *
 * The old page keeps `ImportLimitsInfo` above every step, so it is loudest when it is least
 * useful and gone from view by the time a number could be exceeded. It also re-serializes the
 * whole mapped dataset on every render to compute its size.
 *
 * (The "reuse a saved mapping" list is gone for now: mapping templates are a node feature that
 * does not exist yet, and a dead control that silently does nothing is worse than its absence.)
 */
export function StepUpload({
  wizard,
  onParsed,
}: {
  wizard: ImportWizard
  onParsed: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations()
  const { maxImportFileSizeMB, maxObjectsPerImport } = useAppConfig()
  const [dragging, setDragging] = useState(false)

  async function accept(file: File | undefined) {
    if (!file) return
    if (await wizard.pickFile(file)) onParsed()
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">{t('import.upload.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('import.upload.subtitle')}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        data-testid="import-file-input"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(event) => {
          void accept(event.target.files?.[0])
          // Cleared so picking the SAME file again still fires a change event — otherwise a user
          // who fixes their sheet and re-picks it appears to get no response at all.
          event.target.value = ''
        }}
      />

      <button
        type="button"
        data-testid="import-dropzone"
        {...anchor('importDropzone')}
        disabled={wizard.parsing}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void accept(event.dataTransfer.files[0])
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
          'hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragging && 'border-primary bg-muted/40',
          wizard.parsing && 'pointer-events-none opacity-60'
        )}
      >
        {wizard.parsing ? (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">{t('import.upload.reading')}</p>
            <Progress
              value={wizard.progress}
              data-testid="import-parse-progress"
              className="mt-3 h-1.5 w-48"
            />
          </>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{t('import.upload.dropzone')}</p>
            {/* The caps come from runtime config, like the checks that enforce them — a sentence
                promising 100 MB while the deployment allows 20 is worse than no sentence. */}
            <p className="mt-1 text-sm text-muted-foreground">
              {t('import.upload.limits', {
                size: maxImportFileSizeMB,
                objects: maxObjectsPerImport,
              })}
            </p>
          </>
        )}
      </button>

      {wizard.error && (
        <Alert variant="destructive" data-testid="import-parse-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t(wizard.error.key, wizard.error.values)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
