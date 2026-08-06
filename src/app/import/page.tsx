'use client'

import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { PageHelp } from '@/components/onboarding/page-help'

import { JobList } from './components/job-list'
import { JobDetail } from './components/job-detail'
import { Wizard } from './components/wizard/wizard'
import type { ImportJob } from './types'

/**
 * Bulk import: load many objects from a spreadsheet, with their parent/child links intact.
 *
 * Status and the wizard are TABS rather than two routes, because they are two views of one task —
 * you import, then you watch what happened to it, and the second question follows the first
 * immediately. The predecessor split them across `/import` and `/import-status`, so finishing an
 * import navigated somewhere else and coming back meant starting over.
 *
 * Strings are hardcoded English for now; the translation keys land with the rest of the page's
 * copy rather than mid-migration.
 */
export default function ImportPage() {
  const [openJob, setOpenJob] = useState<ImportJob | null>(null)
  const [tab, setTab] = useState('status')

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          Import
          <PageHelp concept="import" />
        </h1>
        <p className="mt-1 text-muted-foreground">
          Load objects from a spreadsheet, keeping their hierarchy.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="status">Your imports</TabsTrigger>
          <TabsTrigger value="wizard">New import</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-6">
          {openJob ? (
            <JobDetail job={openJob} onBack={() => setOpenJob(null)} />
          ) : (
            <JobList onOpen={setOpenJob} />
          )}
        </TabsContent>

        <TabsContent value="wizard" className="mt-6">
          {/* Finishing the wizard lands on the status list, where the job it just started is the
              top row — the question a user has the moment they press Import. */}
          <Wizard onFinished={() => setTab('status')} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
