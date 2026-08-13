'use client'

import { useTranslations } from 'next-intl'

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, Progress } from '@/components/ui'
import type { ImportProgress } from '@/hooks/api/imports'
import type { ImportProblem } from 'io2p-client'
import { formatTempId } from '@/app/import/lib/build-items'
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'

/**
 * Staging and the hand-off, as two visibly different things.
 *
 * They have different rules and the difference matters: while rows are being UPLOADED the tab has
 * to stay open, and a dropped connection resumes rather than restarts. Once the node has them the
 * job is durable and the tab is free. The old UI showed one spinner for both and then navigated
 * away, so nobody learned which half they were in — or that closing the tab early lost the work.
 *
 * The step's ACTION is not here — it sits in the wizard footer with every other step's, keyed off
 * the phase below.
 */

export type RunPhase = 'refused' | 'handedOver' | 'working' | 'ready'

/**
 * Which of the four screens this is. Exported because the footer button switches on the SAME
 * value: two independent reads of `problems`/`progress`/`isPending` drift into a body with no
 * button, or a button for a body nobody is looking at.
 */
export function runPhase({
  problems,
  progress,
  isPending,
}: {
  problems: readonly ImportProblem[]
  progress: ImportProgress
  isPending: boolean
}): RunPhase {
  if (problems.length > 0) return 'refused'
  if (progress.phase === 'started') return 'handedOver'
  return isPending ? 'working' : 'ready'
}

export function StepImport({
  wizard,
  phase,
  progress,
  problems,
  error,
}: {
  wizard: ImportWizard
  phase: RunPhase
  progress: ImportProgress
  problems: ImportProblem[]
  error: unknown
}) {
  const t = useTranslations()
  const total = wizard.items.length

  // The node refused the envelope. Nothing was written — the job is still a draft — so this is a
  // "go back and fix the mapping", not a partial import to clean up.
  if (phase === 'refused') {
    return (
      <Alert variant="destructive" data-testid="run-refused">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium">{t('import.run.refused')}</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {problems.slice(0, 8).map((problem, index) => {
              // `ImportProblem` carries only `seq`. It indexes the array the browser just
              // submitted, so the file row can be resolved here without the node sending it.
              const sourceRef = wizard.items[problem.seq]?.sourceRef
              return (
                <li key={index}>
                  {/* The node's own detail, in whatever language it speaks — relayed, not
                      translated. Only the frame around it is ours. */}
                  <span className="tabular-nums">
                    {sourceRef
                      ? t('import.run.rowPrefix', { row: sourceRef })
                      : t('import.run.itemPrefix', { item: problem.seq + 1 })}
                  </span>
                  {problem.tempId && ` (${formatTempId(problem.tempId)})`}:{' '}
                  {problem.message}
                </li>
              )
            })}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }

  if (phase === 'handedOver') {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <h3 className="font-medium" data-testid="run-handed-over">
            {t('import.run.handedOver')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('import.run.handedOverDetail', { count: total })}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'working') {
    const staging = progress.phase === 'staging'
    const percent =
      progress.total === 0 ? 0 : (progress.staged / progress.total) * 100

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-medium">
            {staging ? t('import.run.uploading') : t('import.run.validating')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {staging
              ? t('import.run.uploadingDetail')
              : t('import.run.validatingDetail')}
          </p>
        </div>

        <div className="space-y-2">
          <Progress
            value={staging ? percent : 100}
            data-testid="run-progress"
            className="h-2"
          />
          <p
            data-testid="run-staged"
            className="text-sm tabular-nums text-muted-foreground"
          >
            {staging ? (
              t('import.run.uploadedOf', {
                staged: progress.staged,
                total: progress.total,
              })
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('import.run.validatingShort')}
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t('import.run.ready')}</h3>
        <p className="text-sm text-muted-foreground">
          {wizard.file
            ? t('import.run.readyDetailWithFile', {
                count: total,
                file: wizard.file.name,
              })
            : t('import.run.readyDetail', { count: total })}
        </p>
      </div>

      {Boolean(error) && (
        <Alert variant="destructive" data-testid="run-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('import.run.failed')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
