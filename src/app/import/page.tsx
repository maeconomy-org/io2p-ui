'use client'

import { useState } from 'react'

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
 * The header follows objects/processes exactly: `container mx-auto flex-1 p-4`, an `h2` with its
 * PageHelp, and every control on the right of that same row. A page that invents its own heading
 * size and control placement reads as a different application.
 */
export default function ImportPage() {
  const [openJob, setOpenJob] = useState<ImportJob | null>(null)
  const [tab, setTab] = useState('status')

  return (
    <div className="container mx-auto flex-1 p-4">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-semibold">Import</h2>
            <PageHelp concept="import" />
          </div>
          {/* The tabs ARE this page's control, so they sit where every other page puts its
              controls rather than under the heading in a block of their own. */}
          <TabsList>
            <TabsTrigger value="status">Your imports</TabsTrigger>
            <TabsTrigger value="wizard">New import</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="status" className="mt-0">
          {openJob ? (
            <JobDetail job={openJob} onBack={() => setOpenJob(null)} />
          ) : (
            <JobList onNew={() => setTab('wizard')} onOpen={setOpenJob} />
          )}
        </TabsContent>

        {/* `forceMount`, so glancing at the status tab does not throw the import away.

            Radix unmounts inactive tab content, and `useImportWizard` lives inside `Wizard` — so
            switching away destroyed the parsed sheet, the column mapping, the hierarchy and the
            chosen destination, and coming back showed an empty dropzone. Mapping a 60-column
            municipal sheet is real work to lose to a curious click, and this is the same failure
            the redesign notes recorded against the OLD pipeline ("leaving the page destroys the
            mapping"). Hidden rather than unmounted; nothing here fetches until a file is picked. */}
        <TabsContent
          value="wizard"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          {/* Finishing the wizard lands on the status list, where the job it just started is the
              top row — the question a user has the moment they press Import. */}
          <Wizard onFinished={() => setTab('status')} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
