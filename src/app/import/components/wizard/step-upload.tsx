'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'

import { Alert, AlertDescription, Progress } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ImportWizard } from '@/hooks/import/use-import-wizard'

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
  const [dragging, setDragging] = useState(false)

  async function accept(file: File | undefined) {
    if (!file) return
    if (await wizard.pickFile(file)) onParsed()
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Upload a spreadsheet</h3>
        <p className="text-sm text-muted-foreground">
          Excel or CSV. Nothing is created until you confirm at the end.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
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
            <p className="font-medium">Reading your file…</p>
            <Progress value={wizard.progress} className="mt-3 h-1.5 w-48" />
          </>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Drop a file here, or click to choose</p>
            <p className="mt-1 text-sm text-muted-foreground">
              .xlsx or .csv — up to 100 MB and 50,000 rows
            </p>
          </>
        )}
      </button>

      {wizard.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{wizard.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
