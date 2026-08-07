'use client'

import { useState } from 'react'
import { FlaskConical } from 'lucide-react'

import {
  Alert,
  AlertDescription,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

import { JobList } from './components/job-list'
import { JobDetail } from './components/job-detail'
import { Wizard } from './components/wizard/wizard'
import type { LabJob } from './fixtures'

/**
 * A THROWAWAY page for judging import layouts against dummy data. Not linked from the nav, not
 * translated, not tested — deliberately. Everything lives under `src/app/import-lab/`, so it is
 * one `rm -rf` to drop or one move to keep; nothing shared was edited to make it work.
 *
 * Strings are hardcoded English. Adding ~60 keys to en.json and nl.json for a prototype would put
 * the churn in shared files, which is the one thing a scratch page should not do.
 *
 * ── RESTORED, on purpose ──────────────────────────────────────────────────────────────────────
 * This is the original prototype, brought back from 1f0f9e2 exactly as it was, because parts of it
 * are still worth mining — the three-mode hierarchy panel with a sentence explaining each shape,
 * and the fix-in-place Check step. THE SHIPPED FEATURE IS `/import`; this one is frozen and reads
 * fixtures, so anything you like here has to be built there rather than wired up.
 *
 * One line differs from the original: `@/lib/logger` moved to `@/lib/observability/logger`.
 */
export default function ImportLabPage() {
  const [openJob, setOpenJob] = useState<LabJob | null>(null)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          Import lab
        </h1>
        <p className="mt-1 text-muted-foreground">
          Layout sketches on dummy data. Nothing here talks to a backend.
        </p>
      </div>

      <Alert className="mb-6">
        <AlertDescription>
          Shaped to core&apos;s <code>bulk-import-plan.md</code> §3d contract —
          including <code>ok</code> / <code>skipped</code>, <code>staged</code>,
          level progress and the per-row report, none of which the current page
          can show.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Import status</TabsTrigger>
          <TabsTrigger value="wizard">Import wizard</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-6">
          {openJob ? (
            <JobDetail job={openJob} onBack={() => setOpenJob(null)} />
          ) : (
            <JobList onOpen={setOpenJob} />
          )}
        </TabsContent>

        <TabsContent value="wizard" className="mt-6">
          <Wizard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
