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
  Trash2,
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
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  ITEMS_PAGE_SIZE,
  endedWithoutRunning,
  useCancelImport,
  useImportItems,
  useImportJob,
  useStartImport,
} from '@/hooks/api/imports'

import { formatTempId } from '@/app/import/lib/build-items'
import { useIomClient } from '@/lib/io2p'
import { logger } from '@/lib/observability/logger'

import type { ImportItem, ImportJob } from '../types'
import { formatClock, formatDuration, n } from './format'
import { JobStatusBadge } from './job-status-badge'
import { OutcomeBar } from './outcome-bar'

/**
 * The number that answers "did it work?" — deliberately bigger than the percentage, which only
 * answers "how far along is it?". Today's page leads with the percentage and computes success as
 * `processed - failed`, which silently counts skipped rows as created.
 */
function Headline({ job }: { job: ImportJob }) {
  const t = useTranslations()

  if (job.status === 'draft') {
    return (
      <div className="space-y-1" data-testid="job-headline">
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

  // A terminal job that never attempted a row has no outcome to report, and the branch below
  // would tell the operator every row of a discarded import was created. Reachable since
  // discarding a draft became possible: it keeps `total` as history but never runs.
  if (endedWithoutRunning(job)) {
    return (
      <div className="space-y-1" data-testid="job-headline">
        <p className="text-3xl font-semibold">
          {t('import.detail.nothingCreated')}
        </p>
        <p className="text-sm text-muted-foreground">
          {job.status === 'cancelled'
            ? t('import.detail.discardedHint', { total: job.total })
            : t('import.detail.neverRanHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1" data-testid="job-headline">
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
 * The failure report as a file — EVERY row, not the page on screen.
 *
 * It was built from `failedPage.data`, which is one page of the node's default size, so a job with
 * 5,000 failures produced a 20-row CSV. That is the failure mode this button exists to prevent:
 * the table is paged because a screen has to be, and the download is the way out of that.
 *
 * `paginateItems` is an async generator that walks every page, so this is async and the button is
 * disabled while it runs — a large report is several round trips.
 */
async function buildReport(
  client: ReturnType<typeof useIomClient>,
  jobId: string
): Promise<string[][]> {
  // Both columns, unlike the screen: jobs predating `sourceRef` have none, and a single column
  // would have to fall back to `seq` under a heading that says "row".
  const rows: string[][] = [['outcome', 'row', 'item', 'key', 'code', 'reason']]
  for (const status of ['failed', 'skipped'] as const) {
    for await (const item of client.imports.paginateItems(jobId, {
      status,
      size: ITEMS_PAGE_SIZE,
    })) {
      rows.push([
        status,
        item.sourceRef ?? '',
        String(item.seq),
        formatTempId(item.tempId),
        item.error?.code ?? '',
        item.error?.detail ?? '',
      ])
    }
  }
  return rows
}

function writeCsv(jobId: string, rows: string[][]): void {
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
  total,
  kind,
}: {
  items: ImportItem[]
  /** Every row matching the filter, not the page. From the response envelope. */
  total: number
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

  // Jobs predating `sourceRef` have none, so the heading cannot be "Row" unconditionally.
  const isRowNumber = items.every((item) => item.sourceRef)

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[6rem]">
                {isRowNumber
                  ? t('import.detail.columns.row')
                  : t('import.detail.columns.item')}
              </TableHead>
              <TableHead className="w-[12rem]">
                {t('import.detail.columns.key')}
              </TableHead>
              <TableHead>{t('import.detail.columns.reason')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.seq} data-testid={`job-item-${item.seq}`}>
                <TableCell className="tabular-nums font-medium">
                  {item.sourceRef ?? item.seq}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {formatTempId(item.tempId)}
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

      {/* The tab badge counts the whole job, so without this a page of 100 sits under a badge
          reading 5,000 with nothing reconciling them. */}
      {total > items.length && (
        <p className="text-xs text-muted-foreground">
          {t('import.detail.showingFirst', {
            shown: n(items.length),
            total: n(total),
          })}
        </p>
      )}
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
  const client = useIomClient()
  const [tab, setTab] = useState('failed')
  const [downloading, setDownloading] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // POLLS while the job is live and stops once it is not — the counters on this screen are the
  // only place a running import reports itself. The row from the list is the initial value, so
  // the page paints immediately instead of flashing empty.
  const { data: live } = useImportJob(initial.id)
  const job = live ?? initial

  // Two queries rather than one filtered client-side: the report can be thousands of rows, and
  // the two tabs answer different questions — `failed` is the operator's own mistake, `skipped`
  // is the collateral behind it.
  const { data: failedPage } = useImportItems(job.id, {
    status: 'failed',
    page: 1,
    size: ITEMS_PAGE_SIZE,
  })
  const { data: skippedPage } = useImportItems(job.id, {
    status: 'skipped',
    page: 1,
    size: ITEMS_PAGE_SIZE,
  })
  const failed: ImportItem[] = failedPage?.data ?? []
  const skipped: ImportItem[] = skippedPage?.data ?? []
  // `totalElements`, not `data.length` — the page is one page.
  const failedTotal = failedPage?.page.totalElements ?? failed.length
  const skippedTotal = skippedPage?.page.totalElements ?? skipped.length

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
  // `filename` is optional on the DTO — a job created without one still has to be nameable.
  const fileLabel = job.filename || job.id.slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="job-back"
            onClick={onBack}
            aria-label={t('import.detail.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-medium">{fileLabel}</h2>
              <JobStatusBadge status={job.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {t('import.detail.startedAt', {
                time: formatClock(job.startedAt),
              })}{' '}
              · {formatDuration(job.startedAt, job.finishedAt)}
              {job.levels > 1 && (
                <> · {t('import.list.levelCount', { count: job.levels })}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {/* A draft is the one state with no natural end: core's reaper only sweeps `queued` and
              `running`, and there is no DELETE — so without this every refused import and every
              dropped upload sits in the list for good. `cancel` on a draft marks it `cancelled`. */}
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              data-testid="job-discard"
              disabled={cancel.isPending}
              onClick={() => setConfirmDiscard(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t('import.detail.discard')}
            </Button>
          )}
          {isStartable && (
            <Button
              type="button"
              className="gap-2"
              data-testid="job-start"
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
              data-testid="job-cancel"
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
            <Button
              type="button"
              data-testid="job-view-objects"
              onClick={() => router.push('/objects')}
            >
              {t('import.detail.viewObjects')}
            </Button>
          )}
        </div>
      </div>

      {isDraft && !isStartable && (
        <Alert data-testid="job-stalled">
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
        <Alert variant="destructive" data-testid="job-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      {job.failed + job.skipped > 0 && (
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
              data-testid="job-download-csv"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true)
                try {
                  writeCsv(job.id, await buildReport(client, job.id))
                } catch (error) {
                  logger.error('Import report download failed', {
                    jobId: job.id,
                    err: error,
                  })
                  toast.error(t('import.detail.downloadFailed'))
                } finally {
                  setDownloading(false)
                }
              }}
            >
              <Download className="h-4 w-4" />
              {/* Counted from the JOB, not from the page on screen: `failed.length` is 20 for a
                  job with 5,000 failures, and the button would promise 20. */}
              {t('import.detail.downloadCsv', {
                count: job.failed + job.skipped,
              })}
            </Button>
          </div>

          {/* Failed and skipped are separated because they are different problems: one is the
              operator's data, the other is collateral from a parent that failed. Merging them
              back into one list is what makes a report unactionable. */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger
                value="failed"
                data-testid="job-tab-failed"
                className="gap-2"
              >
                {t('import.detail.tabs.failed')}
                <Badge
                  variant="outline"
                  className={cn(job.failed > 0 && 'text-destructive')}
                >
                  {job.failed}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="skipped"
                data-testid="job-tab-skipped"
                className="gap-2"
              >
                {t('import.detail.tabs.skipped')}
                <Badge variant="outline">{job.skipped}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="failed" className="mt-3">
              <ItemsTable items={failed} total={failedTotal} kind="failed" />
            </TabsContent>
            <TabsContent value="skipped" className="mt-3">
              <p className="mb-3 text-sm text-muted-foreground">
                {t('import.detail.skippedExplainer')}
              </p>
              <ItemsTable items={skipped} total={skippedTotal} kind="skipped" />
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
          <span data-testid="job-polling" className="flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3 animate-spin" aria-hidden />
            {t('import.detail.polling')}
          </span>
        )}
      </div>

      {/* Confirmed because it cannot be undone: a cancelled job can never be started, so a fully
          staged draft discarded by mistake means uploading the file again. */}
      <DeleteConfirmationDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        objectName={fileLabel}
        title={t('import.detail.discardConfirmTitle')}
        description={t('import.detail.discardConfirmDescription', {
          file: fileLabel,
        })}
        confirmLabel={t('import.detail.discard')}
        disabled={cancel.isPending}
        onDelete={() => {
          cancel.mutate(job.id)
          setConfirmDiscard(false)
          onBack()
        }}
      />
    </div>
  )
}
