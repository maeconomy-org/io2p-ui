'use client'

import { useState } from 'react'
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

import type { LabItem, LabJob } from '../fixtures'
import { LAB_ITEMS } from '../fixtures'
import {
  JobStatusBadge,
  OutcomeBar,
  formatClock,
  formatDuration,
  n,
} from './lab-bits'

const EMPTY_ITEMS: LabItem[] = []

/**
 * The number that answers "did it work?" — deliberately bigger than the percentage, which only
 * answers "how far along is it?". Today's page leads with the percentage and computes success as
 * `processed - failed`, which silently counts skipped rows as created.
 */
function Headline({ job }: { job: LabJob }) {
  if (job.status === 'draft') {
    return (
      <div className="space-y-1">
        <p className="text-3xl font-semibold tabular-nums">
          {n(job.staged)}{' '}
          <span className="text-lg font-normal text-muted-foreground">
            of {n(job.total)} rows uploaded
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Nothing has been created yet. Uploading picks up where it stopped.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-3xl font-semibold tabular-nums">
        {n(job.ok)}{' '}
        <span className="text-lg font-normal text-muted-foreground">
          object{job.ok === 1 ? '' : 's'} created
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        {job.failed > 0 || job.skipped > 0 ? (
          <>
            {n(job.failed)} row{job.failed === 1 ? '' : 's'} could not be
            created
            {job.skipped > 0 && (
              <> and {n(job.skipped)} were skipped because a parent failed</>
            )}
            .
          </>
        ) : (
          <>Every row in the sheet was created.</>
        )}
      </p>
    </div>
  )
}

function ItemsTable({
  items,
  kind,
}: {
  items: LabItem[]
  kind: 'failed' | 'skipped'
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No {kind} rows.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* `seq` is the line in THEIR sheet — the only address the operator can act on. */}
            <TableHead className="w-[6rem]">Sheet row</TableHead>
            <TableHead className="w-[12rem]">Key</TableHead>
            <TableHead>Reason</TableHead>
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
                    {item.code}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {item.detail}
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
  job,
  onBack,
}: {
  job: LabJob
  onBack: () => void
}) {
  const [tab, setTab] = useState('failed')
  const items = LAB_ITEMS[job.id] ?? EMPTY_ITEMS
  const failed = items.filter((i) => i.status === 'failed')
  const skipped = items.filter((i) => i.status === 'skipped')

  const isDraft = job.status === 'draft'
  const isRunning = job.status === 'running'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to imports"
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
              {job.levels > 1 && <> · {job.levels} levels deep</>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isDraft && (
            <Button type="button" className="gap-2">
              <Play className="h-4 w-4" />
              Resume upload
            </Button>
          )}
          {isRunning && (
            <Button type="button" variant="destructive" className="gap-2">
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          )}
          {(job.status === 'completed' ||
            job.status === 'completed_with_errors') && (
            <Button type="button">View objects</Button>
          )}
        </div>
      </div>

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
              Creating level {job.currentLevel} of {job.levels} — children wait
              for their parents.
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

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">What did not import</h3>
              <p className="text-sm text-muted-foreground">
                Fix these rows in your sheet and import just them again.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download {failed.length + skipped.length} rows as CSV
            </Button>
          </div>

          {/* Failed and skipped are separated because they are different problems: one is the
              operator's data, the other is collateral from a parent that failed. Merging them
              back into one list is what makes a report unactionable. */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="failed" className="gap-2">
                Failed
                <Badge
                  variant="outline"
                  className={cn(failed.length > 0 && 'text-destructive')}
                >
                  {failed.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="skipped" className="gap-2">
                Skipped
                <Badge variant="outline">{skipped.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="failed" className="mt-3">
              <ItemsTable items={failed} kind="failed" />
            </TabsContent>
            <TabsContent value="skipped" className="mt-3">
              <p className="mb-3 text-sm text-muted-foreground">
                These rows were never attempted — the object they hang from
                failed first. Fixing the parent usually fixes all of them.
              </p>
              <ItemsTable items={skipped} kind="skipped" />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Job <code className="rounded bg-muted px-1.5 py-0.5">{job.id}</code>
        </span>
        {isRunning && (
          <span className="flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3 animate-spin" aria-hidden />
            Updating every 2 seconds
          </span>
        )}
      </div>
    </div>
  )
}
