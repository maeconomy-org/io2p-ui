'use client'

import { useTranslations } from 'next-intl'

import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react'

import { Alert, AlertDescription, Button, Progress } from '@/components/ui'
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
  const t = useTranslations()
  const total = wizard.items.length

  // The node refused the envelope. Nothing was written — the job is still a draft — so this is a
  // "go back and fix the mapping", not a partial import to clean up.
  if (problems.length > 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
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
        <Button type="button" variant="outline" onClick={onDone}>
          {t('import.run.backToMapping')}
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
            <h3 className="font-medium">{t('import.run.handedOver')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('import.run.handedOverDetail', { count: total })}
            </p>
          </div>
        </div>
        <Button type="button" onClick={onDone}>
          {t('import.run.seeStatus')}
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
            {staging ? t('import.run.uploading') : t('import.run.validating')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {staging
              ? t('import.run.uploadingDetail')
              : t('import.run.validatingDetail')}
          </p>
        </div>

        <div className="space-y-2">
          <Progress value={staging ? percent : 100} className="h-2" />
          <p className="text-sm tabular-nums text-muted-foreground">
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
    <div className="space-y-6">
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
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('import.run.failed')}
          </AlertDescription>
        </Alert>
      )}

      <Button type="button" onClick={onStart} className="gap-2">
        <Upload className="h-4 w-4" />
        {t('import.actions.importCount', { count: total })}
      </Button>
    </div>
  )
}
