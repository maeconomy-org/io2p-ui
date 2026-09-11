'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, Upload } from 'lucide-react'

import { Button } from '@/components/ui'
import { DataTable } from '@/components/entity-list'

import { endedWithoutRunning, useImports } from '@/hooks/api/imports'

import type { ImportJob } from '../types'
import { formatClock, formatDuration } from './format'
import { JobStatusBadge } from './job-status-badge'
import { OutcomeBar } from './outcome-bar'

/** Matches the node's own list default, so page 1 needs no size round-trip to look right. */
const PAGE_SIZE = 20

/**
 * The job list as a DataTable rather than a hand-rolled accordion.
 *
 * The row IS the summary — status, outcome and duration are all readable without expanding
 * anything, which is the reason the accordion existed. Detail then earns a route of its own
 * instead of pushing every other job off the screen.
 */
type Translate = ReturnType<typeof useTranslations>

function buildColumns(t: Translate): ColumnDef<ImportJob, unknown>[] {
  return [
    {
      id: 'file',
      header: t('import.list.columns.file'),
      // Capped, because the filename is the one unbounded value here — a real export arrives
      // called "CONFIDENTIAL - MAECONOMY - GHE - MultiPack Processed - … (1).xlsx", and without
      // a ceiling it pushes Duration off the right-hand edge of a table that clips overflow.
      meta: { cellClassName: 'max-w-[22rem]' },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {row.original.filename || t('import.list.untitled')}
            </span>
          </div>
          <code className="text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}
          </code>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('import.list.columns.status'),
      cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
    },
    {
      id: 'outcome',
      header: t('import.list.columns.outcome'),
      cell: ({ row }) => {
        const job = row.original
        // A draft has not run: showing a 0-of-N outcome bar would read as "nothing worked"
        // rather than "not started". Staging progress is a different measurement.
        if (job.status === 'draft') {
          return (
            <div className="space-y-1.5" data-testid="job-staging-progress">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-blue-500/60"
                  style={{ width: `${(job.staged / job.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t('import.run.uploadedOf', {
                  staged: job.staged,
                  total: job.total,
                })}
              </p>
            </div>
          )
        }
        // Same reason as the draft branch above, for a job that ended without running: an
        // OutcomeBar reading "0 created … of 500" says every row failed, not that none were tried.
        if (endedWithoutRunning(job)) {
          return (
            <span
              data-testid="job-nothing-attempted"
              className="text-sm text-muted-foreground"
            >
              {t('import.list.nothingAttempted')}
            </span>
          )
        }
        return (
          <OutcomeBar
            total={job.total}
            processed={job.processed}
            ok={job.ok}
            failed={job.failed}
            skipped={job.skipped}
            className="min-w-[15rem]"
          />
        )
      },
    },
    {
      id: 'levels',
      header: t('import.list.columns.depth'),
      cell: ({ row }) => {
        const { levels, currentLevel, status } = row.original
        if (levels <= 1)
          return (
            <span className="text-muted-foreground">
              {t('import.list.flat')}
            </span>
          )
        return (
          <span className="tabular-nums text-sm">
            {status === 'running'
              ? t('import.list.levelProgress', {
                  current: currentLevel,
                  total: levels,
                })
              : t('import.list.levelCount', { count: levels })}
          </span>
        )
      },
    },
    {
      id: 'started',
      header: t('import.list.columns.started'),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatClock(row.original.startedAt)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: t('import.list.columns.duration'),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatDuration(row.original.startedAt, row.original.finishedAt)}
        </span>
      ),
    },
  ]
}

export function JobList({
  onNew,
  onOpen,
}: {
  onNew: () => void
  onOpen: (job: ImportJob) => void
}) {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  // Owner-scoped on the node — there is no filter to pass, and nothing to share.
  const { data, isLoading } = useImports({ page, size: PAGE_SIZE })
  const jobs = data?.data ?? []
  const meta = data?.page
  const totalPages = meta?.totalPages ?? 0

  const goTo = (next: number) =>
    setPage(Math.min(Math.max(next, 1), Math.max(totalPages, 1)))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('import.list.subtitle')}
      </p>

      <DataTable
        columns={buildColumns(t)}
        data={jobs}
        fetching={isLoading}
        getRowId={(job) => job.id}
        onRowClick={onOpen}
        // 1-BASED. DataTable subtracts one itself before handing it to the pagination control, so
        // the `- 1` that used to be here made page 1 render as -1. The node also counts from 1.
        pagination={{
          currentPage: meta?.number ?? 1,
          pageSize: meta?.size ?? PAGE_SIZE,
          totalElements: meta?.totalElements ?? 0,
          totalPages,
          isFirstPage: (meta?.number ?? 1) <= 1,
          isLastPage: (meta?.number ?? 1) >= Math.max(totalPages, 1),
        }}
        // Without these the arrows rendered and did nothing: DataTable calls the optional
        // `onPageChange?.()` and nothing was ever passed.
        onPageChange={(zeroBased) => goTo(zeroBased + 1)}
        onFirstPage={() => goTo(1)}
        onPreviousPage={() => goTo(page - 1)}
        onNextPage={() => goTo(page + 1)}
        onLastPage={() => goTo(totalPages)}
        emptyIcon={<FileSpreadsheet className="h-12 w-12" />}
        emptyTitle={t('import.list.emptyTitle')}
        emptyDescription={t('import.list.emptyDescription')}
        emptyAction={
          <Button
            type="button"
            data-testid="import-new"
            onClick={onNew}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {t('import.actions.newImport')}
          </Button>
        }
      />
    </div>
  )
}
