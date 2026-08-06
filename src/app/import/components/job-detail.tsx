'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Download,
  FileSpreadsheet,
  Layers,
  Play,
  RotateCcw,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

import { useRouter } from 'next/navigation'

import {
  useCancelImport,
  useImportItems,
  useImportJob,
  useStartImport,
} from '@/hooks/api/imports'

import type { ImportItem, ImportJob } from '../types'
import {
  JobStatusBadge,
  OutcomeBar,
  formatClock,
  formatDuration,
  n,
} from './job-bits'

/**
 * The number that answers "did it work?" — deliberately bigger than the percentage, which only
 * answers "how far along is it?". Today's page leads with the percentage and computes success as
 * `processed - failed`, which silently counts skipped rows as created.
 */
function Headline({ job }: { job: ImportJob }) {
  const t = useTranslations()

  if (job.status === 'draft') {
    return (
      <div className="space-y-1">
        <p className="text-3xl font-semibold tabular-nums">
          {n(job.staged)}{' '}
          <span className="text-lg font-normal text-muted-foreground">
            {t('import.detail.ofRowsUploaded', { total: job.total })}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t('import.detail.draftHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-3xl font-semibold tabular-nums">
        {n(job.ok)}{' '}
        <span className="text-lg font-normal text-muted-foreground">
          {/* Pluralised by the message, not by a `? '' : 's'` — that construction only ever
              produces English, and there are two more of them below. */}
          {t('import.detail.objectsCreated', { count: job.ok })}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        {job.failed > 0 || job.skipped > 0
          ? job.skipped > 0
            ? t('import.detail.failedAndSkipped', {
                failed: job.failed,
                skipped: job.skipped,
              })
            : t('import.detail.failedOnly', { failed: job.failed })
          : t('import.detail.allCreated')}
      </p>
    </div>
  )
}

/**
 * Escape one CSV field.
 *
 * A reason string routinely contains a comma, and a `key` for a level import is a path. Quoting
 * everything and doubling inner quotes is the whole of RFC 4180 that matters here, and it is far
 * less code than a dependency.
 */
function csvField(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

/**
 * The failure report as a file, built from what is already on screen.
 *
 * No request: the rows were fetched to render the table, so re-asking for them would be a second
 * answer to a question already answered. It is also the only way to get the WHOLE list — the
 * screen shows a page of it, and "fix these rows" is not something anyone can do 20 at a time.
 */
function downloadReport(
  jobId: string,
  failed: ImportItem[],
  skipped: ImportItem[]
): void {
  const rows = [
    ['outcome', 'item', 'key', 'code', 'reason'],
    ...failed.map((item) => [
      'failed',
      item.seq,
      item.tempId,
      item.error?.code ?? '',
      item.error?.detail ?? '',
    ]),
    ...skipped.map((item) => [
      'skipped',
      item.seq,
      item.tempId,
      item.error?.code ?? '',
      item.error?.detail ?? '',
    ]),
  ]
  // BOM so Excel opens it as UTF-8 — without it a German or Dutch reason renders as mojibake in
  // the one application the operator is certain to use.
  const csv = '﻿' + rows.map((row) => row.map(csvField).join(',')).join('\r\n')

  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `import-${jobId}-problems.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function ItemsTable({
  items,
  kind,
}: {
  items: ImportItem[]
  kind: 'failed' | 'skipped'
}) {
  const t = useTranslations()
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t(`import.detail.noRows.${kind}`)}
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* NOT the sheet row, though it was labelled that. `seq` is the item's position in
                the envelope, and with a hierarchy on those are different things — 4 rows become 9
                items, so item 7 is no line in anyone's spreadsheet. The KEY column is what leads
                back to the data; for a level import it is the object's path.

                A real row reference would have to travel on the envelope, which is core's call.
                Until then, saying "item" is the honest version. */}
            <TableHead className="w-[6rem]">
              {t('import.detail.columns.item')}
            </TableHead>
            <TableHead className="w-[12rem]">
              {t('import.detail.columns.key')}
            </TableHead>
            <TableHead>{t('import.detail.columns.reason')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.seq}>
              <TableCell className="tabular-nums font-medium">
                {item.seq}
              </TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {item.tempId}
                </code>
              </TableCell>
              <TableCell>
                <div className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className="shrink-0 font-mono text-[10px]"
                  >
                    {item.error?.code ?? '—'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {item.error?.detail ?? ''}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function JobDetail({
  job: initial,
  onBack,
}: {
  job: ImportJob
  onBack: () => void
}) {
  const t = useTranslations()
  const [tab, setTab] = useState('failed')
  // POLLS while the job is live and stops once it is not — the counters on this screen are the
  // only place a running import reports itself. The row from the list is the initial value, so
  // the page paints immediately instead of flashing empty.
  const { data: live } = useImportJob(initial.id)
  const job = live ?? initial

  // Two queries rather than one filtered client-side: the report can be thousands of rows, and
  // the two tabs answer different questions — `failed` is the operator's own mistake, `skipped`
  // is the collateral behind it.
  const { data: failedPage } = useImportItems(job.id, { status: 'failed' })
  const { data: skippedPage } = useImportItems(job.id, { status: 'skipped' })
  const failed: ImportItem[] = failedPage?.data ?? []
  const skipped: ImportItem[] = skippedPage?.data ?? []

  const router = useRouter()
  const cancel = useCancelImport()
  const start = useStartImport()

  const isDraft = job.status === 'draft'
  const isRunning = job.status === 'running' || job.status === 'queued'
  const isFinished =
    job.status === 'completed' || job.status === 'completed_with_errors'
  // A draft whose rows all landed can still be handed over — the node has them. One that stopped
  // part-way cannot, because resuming needs the original file and the browser no longer has it.
  const isStartable = isDraft && job.staged === job.total && job.total > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t('import.detail.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-medium">{job.filename}</h2>
              <JobStatusBadge status={job.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              Started {formatClock(job.startedAt)} ·{' '}
              {formatDuration(job.startedAt, job.finishedAt)}
              {job.levels > 1 && (
                <> · {t('import.list.levelCount', { count: job.levels })}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isStartable && (
            <Button
              type="button"
              className="gap-2"
              disabled={start.isPending}
              onClick={() => start.mutate(job.id)}
            >
              <Play className="h-4 w-4" />
              {t('import.detail.startImport')}
            </Button>
          )}
          {isRunning && (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              // Held in the "stopping" state by the MUTATION rather than by the job: cancel is
              // cooperative, so the worker only notices at the next batch boundary and the status
              // stays `running` for a moment. Without this the button springs back to "Cancel"
              // and invites a second click at the one moment it looks like nothing happened.
              // (`cancelRequested` is stored on the node but not exposed on the DTO.)
              disabled={cancel.isPending || cancel.isSuccess}
              onClick={() => cancel.mutate(job.id)}
            >
              <Ban className="h-4 w-4" />
              {cancel.isPending || cancel.isSuccess
                ? t('import.detail.stopping')
                : t('common.cancel')}
            </Button>
          )}
          {isFinished && job.ok > 0 && (
            // The objects list has no deep-link filter, so this goes to the list itself rather
            // than to a view of THIS import's rows. Honest, and still the place they landed.
            <Button type="button" onClick={() => router.push('/objects')}>
              {t('import.detail.viewObjects')}
            </Button>
          )}
        </div>
      </div>

      {isDraft && !isStartable && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('import.detail.stalledUpload', {
              staged: job.staged,
              total: job.total,
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-6">
        <Headline job={job} />

        <div className="mt-5">
          {isDraft ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-500/60"
                style={{ width: `${(job.staged / job.total) * 100}%` }}
              />
            </div>
          ) : (
            <OutcomeBar
              total={job.total}
              processed={job.processed}
              ok={job.ok}
              failed={job.failed}
              skipped={job.skipped}
            />
          )}
        </div>

        {/* Level progress only exists for a hierarchical import, and it is the one thing that
            explains WHY a run pauses on a big sheet: level 2 cannot start until level 1 lands. */}
        {isRunning && job.levels > 1 && (
          <div className="mt-5 flex items-center gap-2 border-t pt-4 text-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {t('import.detail.creatingLevel', {
                current: job.currentLevel,
                total: job.levels,
              })}
            </span>
          </div>
        )}
      </div>

      {job.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      {failed.length + skipped.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                {t('import.detail.problemsTitle')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('import.detail.problemsSubtitle')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => downloadReport(job.id, failed, skipped)}
            >
              <Download className="h-4 w-4" />
              {t('import.detail.downloadCsv', {
                count: failed.length + skipped.length,
              })}
            </Button>
          </div>

          {/* Failed and skipped are separated because they are different problems: one is the
              operator's data, the other is collateral from a parent that failed. Merging them
              back into one list is what makes a report unactionable. */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="failed" className="gap-2">
                {t('import.detail.tabs.failed')}
                <Badge
                  variant="outline"
                  className={cn(failed.length > 0 && 'text-destructive')}
                >
                  {failed.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="skipped" className="gap-2">
                {t('import.detail.tabs.skipped')}
                <Badge variant="outline">{skipped.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="failed" className="mt-3">
              <ItemsTable items={failed} kind="failed" />
            </TabsContent>
            <TabsContent value="skipped" className="mt-3">
              <p className="mb-3 text-sm text-muted-foreground">
                {t('import.detail.skippedExplainer')}
              </p>
              <ItemsTable items={skipped} kind="skipped" />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('import.detail.jobLabel')}{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">{job.id}</code>
        </span>
        {isRunning && (
          <span className="flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3 animate-spin" aria-hidden />
            {t('import.detail.polling')}
          </span>
        )}
      </div>
    </div>
  )
}
