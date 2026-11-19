'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Upload } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

type Phase = 'staging' | 'handed-off'

/**
 * Staging and the hand-off, as two visibly different things.
 *
 * They have different rules and the difference matters: while rows are being UPLOADED the tab has
 * to stay open, and a dropped connection resumes rather than restarts. Once the server has them,
 * the job is durable and the tab is free. Today's UI shows one spinner for both and then navigates
 * away, so nobody learns which half they are in.
 */
export function StepImport() {
  const [phase, setPhase] = useState<Phase>('staging')
  const staged = phase === 'staging' ? 3400 : 9000
  const total = 9000

  return (
    <div className="space-y-6">
      {phase === 'staging' ? (
        <>
          <div>
            <h3 className="font-medium">Uploading rows</h3>
            <p className="text-sm text-muted-foreground">
              Keep this tab open until the upload finishes. Nothing has been
              created yet.
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(staged / total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm tabular-nums">
              <span className="font-medium">
                {staged.toLocaleString('en-US')} of{' '}
                {total.toLocaleString('en-US')} rows
              </span>
              <span className="text-muted-foreground">chunk 7 of 18</span>
            </div>
          </div>

          {/* Byte-sized chunks, not row counts: a row spans 30x in size depending on how many
              properties it carries, so "how many rows fit in a request" has no fixed answer. */}
          <p className="text-xs text-muted-foreground">
            Sent in 6 MB batches. If the connection drops, uploading continues
            from row {staged.toLocaleString('en-US')} rather than starting over.
          </p>

          <div className="flex items-center gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm">
              Cancel upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPhase('handed-off')}
              className="text-muted-foreground"
            >
              (demo: finish upload)
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="font-medium">Import started</h3>
              <p className="text-sm text-muted-foreground">
                All 9,000 rows are on the server. You can close this tab — the
                import keeps running.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span className="font-medium">Creating objects</span>
              <span className="text-muted-foreground tabular-nums">
                level 1 of 3
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Roughly 4 minutes for a sheet this size.
            </p>
          </div>

          <div
            className={cn(
              'flex flex-col gap-2 border-t pt-4',
              'sm:flex-row sm:items-center'
            )}
          >
            <Button type="button" className="gap-2 sm:flex-1">
              <Upload className="h-4 w-4" />
              Watch progress
            </Button>
            <Button type="button" variant="outline" className="sm:flex-1">
              Import another file
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
