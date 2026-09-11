'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, Upload } from 'lucide-react'

import { Button } from '@/components/ui'
import { DataTable } from '@/components/entity-list'

import type { LabJob } from '../fixtures'
import { LAB_JOBS } from '../fixtures'
import {
  JobStatusBadge,
  OutcomeBar,
  formatClock,
  formatDuration,
  n,
} from './lab-bits'

/**
 * The job list as a DataTable rather than a hand-rolled accordion.
 *
 * The row IS the summary — status, outcome and duration are all readable without expanding
 * anything, which is the reason the accordion existed. Detail then earns a route of its own
 * instead of pushing every other job off the screen.
 */
function buildColumns(): ColumnDef<LabJob, unknown>[] {
  return [
    {
      id: 'file',
      header: 'Import',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.original.filename}</span>
          </div>
          <code className="text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}
          </code>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
    },
    {
      id: 'outcome',
      header: 'Outcome',
      cell: ({ row }) => {
        const job = row.original
        // A draft has not run: showing a 0-of-N outcome bar would read as "nothing worked"
        // rather than "not started". Staging progress is a different measurement.
        if (job.status === 'draft') {
          return (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-blue-500/60"
                  style={{ width: `${(job.staged / job.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {n(job.staged)} of {n(job.total)} rows uploaded
              </p>
            </div>
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
      header: 'Depth',
      cell: ({ row }) => {
        const { levels, currentLevel, status } = row.original
        if (levels <= 1)
          return <span className="text-muted-foreground">Flat</span>
        return (
          <span className="tabular-nums text-sm">
            {status === 'running'
              ? `${currentLevel} of ${levels}`
              : `${levels} levels`}
          </span>
        )
      },
    },
    {
      id: 'started',
      header: 'Started',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatClock(row.original.startedAt)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatDuration(row.original.startedAt, row.original.finishedAt)}
        </span>
      ),
    },
  ]
}

export function JobList({ onOpen }: { onOpen: (job: LabJob) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Imports</h2>
          <p className="text-sm text-muted-foreground">
            Every import you have run. A job keeps running if you close the tab.
          </p>
        </div>
        <Button type="button" className="gap-2">
          <Upload className="h-4 w-4" />
          New import
        </Button>
      </div>

      <DataTable
        columns={buildColumns()}
        data={LAB_JOBS}
        getRowId={(job) => job.id}
        onRowClick={onOpen}
        pagination={{
          currentPage: 0,
          pageSize: 20,
          totalElements: LAB_JOBS.length,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
        }}
        emptyIcon={<FileSpreadsheet className="h-12 w-12" />}
        emptyTitle="No imports yet"
      />
    </div>
  )
}
