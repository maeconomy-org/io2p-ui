'use client'

import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react'

import { Alert, AlertDescription, Button, Progress } from '@/components/ui'
import type { ImportProgress } from '@/hooks/api/imports'
import type { ImportProblem } from 'io2p-client'
import type { ImportWizard } from '@/hooks/import/use-import-wizard'

/**
 * Staging and the hand-off, as two visibly different things.
 *
 * They have different rules and the difference matters: while rows are being UPLOADED the tab has
 * to stay open, and a dropped connection resumes rather than restarts. Once the node has them the
 * job is durable and the tab is free. The old UI showed one spinner for both and then navigated
 * away, so nobody learned which half they were in — or that closing the tab early lost the work.
 */
export function StepImport({
  wizard,
  progress,
  problems,
  isPending,
  error,
  onStart,
  onDone,
}: {
  wizard: ImportWizard
  progress: ImportProgress
  problems: ImportProblem[]
  isPending: boolean
  error: unknown
  onStart: () => void
  onDone: () => void
}) {
  const total = wizard.items.length

  // The node refused the envelope. Nothing was written — the job is still a draft — so this is a
  // "go back and fix the mapping", not a partial import to clean up.
  if (problems.length > 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">
              The import was refused — nothing was created
            </p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {problems.slice(0, 8).map((problem, index) => (
                <li key={index}>
                  <span className="tabular-nums">Row {problem.seq + 1}</span>
                  {problem.tempId && ` (${problem.tempId})`}: {problem.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={onDone}>
          Back to the mapping
        </Button>
      </div>
    )
  }

  if (progress.phase === 'started') {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="font-medium">Handed over to the server</h3>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString('en-US')} objects are being created. You can
              close this tab — the job keeps running, and the status page shows
              what happened to every row.
            </p>
          </div>
        </div>
        <Button type="button" onClick={onDone}>
          See the import status
        </Button>
      </div>
    )
  }

  if (isPending) {
    const staging = progress.phase === 'staging'
    const percent =
      progress.total === 0 ? 0 : (progress.staged / progress.total) * 100

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-medium">
            {staging ? 'Uploading rows' : 'Checking your data'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {staging
              ? 'Keep this tab open until the upload finishes. Nothing has been created yet.'
              : 'Running the same checks the server runs. Still nothing created.'}
          </p>
        </div>

        <div className="space-y-2">
          <Progress value={staging ? percent : 100} className="h-2" />
          <p className="text-sm tabular-nums text-muted-foreground">
            {staging ? (
              <>
                {progress.staged.toLocaleString('en-US')} of{' '}
                {progress.total.toLocaleString('en-US')} rows uploaded
              </>
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating…
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Ready to import</h3>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString('en-US')} objects will be created
          {wizard.file ? ` from ${wizard.file.name}` : ''}. This cannot be
          undone — objects can be deleted afterwards, but not un-created.
        </p>
      </div>

      {Boolean(error) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : 'The import failed'}
          </AlertDescription>
        </Alert>
      )}

      <Button type="button" onClick={onStart} className="gap-2">
        <Upload className="h-4 w-4" />
        Import {total.toLocaleString('en-US')} objects
      </Button>
    </div>
  )
}
