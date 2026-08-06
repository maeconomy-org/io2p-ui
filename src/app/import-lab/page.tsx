'use client'

import { useState } from 'react'
import { FlaskConical } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

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
 */
export default function ImportLabPage() {
  const [openJob, setOpenJob] = useState<LabJob | null>(null)
  const [tab, setTab] = useState('status')

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          Import lab
        </h1>
        <p className="mt-1 text-muted-foreground">
          The bulk import, wired to the node.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
          {/* Finishing the wizard lands on the status list, where the job it just started is the
              top row — the question a user has the moment they press Import. */}
          <Wizard onFinished={() => setTab('status')} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
