'use client'

import { useState, type FormEventHandler, type ReactNode } from 'react'

import { UnsavedChangesDialog } from '@/components/drafts/unsaved-changes-dialog'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetDropzone,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { anchor } from '@/constants'

import { DirtyDot, UnsavedBar } from './sheet-lifecycle-footer'

export interface SheetTab {
  value: string
  label: string
  /** Marks the trigger with a dot when this tab holds edited fields. */
  dirty: boolean
  /**
   * Plain content, or a render prop receiving `guardUnsaved` — same shape as `footer`, and needed
   * for the same reason: anything inside a tab that LEAVES the sheet (a link out, a route push)
   * throws away unsaved work, and a guard the panel applies but a tab skips is worse than none.
   */
  content: ReactNode | ((guardUnsaved: GuardUnsaved) => ReactNode)
}

export type GuardUnsaved = (proceed: () => void) => void

// Tailwind resolves classes from literal source text, so the column count can't be interpolated.
const TAB_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

export interface EntitySheetShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Already-resolved heading text; also the accessible description. */
  title: string
  /** Status badges beside the title (deleted, system, …). */
  badges?: ReactNode
  loading: boolean
  /** Drops are only accepted in edit mode. */
  editing: boolean
  isDirty: boolean
  dirtyCount: number
  /** Omit for an entity that cannot hold files — the dropzone is then not mounted at all. */
  onFiles?: (files: File[]) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  /** Tabbed body (edit/view). Omit for a linear body and pass `children` instead. */
  tabs?: SheetTab[]
  /** Linear body, used when `tabs` is omitted — the create flow. */
  children?: ReactNode
  /**
   * Offered as a third option when closing dirty. Omit on an edit — the entity already exists
   * server-side, so a local draft of it would be a rival copy with no way to say which is newer.
   */
  onSaveDraft?: () => void
  /** Warn in the close dialog that pending file picks cannot be carried into a draft. */
  droppedUploads?: boolean
  /**
   * Receives `guardUnsaved` so footer buttons that throw work away — Cancel, above all — run the
   * same prompt as closing does. A guard the panel applies but the footer skips is worse than none:
   * Escape asks, and the button right next to Save silently discards.
   */
  footer: (guardUnsaved: GuardUnsaved) => ReactNode
}

/**
 * The chrome every entity sheet shares: the sliding panel, header, loading skeleton, whole-sheet
 * dropzone, the single `<form>` that wraps body and footer, and the unsaved-changes strip.
 *
 * What varies between entities is content, so it arrives as slots — `tabs` for the view/edit body,
 * `children` for the linear create body, `footer` for the lifecycle buttons. Tabs are a descriptor
 * list rather than markup so the trigger row, dirty dots and column count stay consistent however
 * many tabs an entity has.
 *
 * Closing with unsaved work confirms first; that guard lives here because the shell owns the panel's
 * open state, and every sheet that forgot it would lose a user's edits silently.
 */
export function EntitySheetShell({
  open,
  onOpenChange,
  title,
  badges,
  loading,
  editing,
  isDirty,
  dirtyCount,
  onFiles,
  onSubmit,
  tabs,
  children,
  onSaveDraft,
  droppedUploads,
  footer,
}: EntitySheetShellProps) {
  // Wrapped in an object because `useState` treats a bare function as a lazy initializer and would
  // call the pending action instead of storing it.
  const [pending, setPending] = useState<{ run: () => void } | null>(null)

  const guardUnsaved = (proceed: () => void) => {
    if (!isDirty) {
      proceed()
      return
    }
    setPending({ run: proceed })
  }

  const resolve = () => {
    const run = pending?.run
    setPending(null)
    run?.()
  }

  const requestClose = () => guardUnsaved(() => onOpenChange(false))

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <SheetContent
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl"
          data-testid="entity-sheet"
        >
          <SheetHeader className="border-b px-6 py-4 pr-12">
            <SheetTitle className="flex items-center gap-2">
              <span className="min-w-0 truncate">{title}</span>
              {badges}
            </SheetTitle>
            <SheetDescription className="sr-only">{title}</SheetDescription>
          </SheetHeader>

          {loading && (
            <div className="flex-1 space-y-3 px-6 py-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          )}

          {!loading && (
            <MaybeDropzone onFiles={onFiles} editing={editing}>
              <form
                onSubmit={onSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                {tabs ? (
                  <Tabs
                    defaultValue={tabs[0]?.value}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="px-6 pt-4">
                      <TabsList
                        {...anchor('sheetTabs')}
                        className={cn(
                          'grid w-full',
                          TAB_COLUMNS[tabs.length] ?? 'grid-cols-3'
                        )}
                      >
                        {tabs.map((tab) => (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            data-testid={`sheet-tab-${tab.value}`}
                          >
                            {tab.label}
                            <DirtyDot show={tab.dirty} />
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    <SheetBody>
                      {tabs.map((tab) => (
                        <TabsContent
                          key={tab.value}
                          value={tab.value}
                          className="mt-0"
                        >
                          {typeof tab.content === 'function'
                            ? tab.content(guardUnsaved)
                            : tab.content}
                        </TabsContent>
                      ))}
                    </SheetBody>
                  </Tabs>
                ) : (
                  <SheetBody>{children}</SheetBody>
                )}

                {isDirty && <UnsavedBar count={dirtyCount} />}

                {footer(guardUnsaved)}
              </form>
            </MaybeDropzone>
          )}
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        count={dirtyCount}
        onSaveDraft={
          onSaveDraft
            ? () => {
                onSaveDraft()
                resolve()
              }
            : undefined
        }
        onDiscard={resolve}
        droppedUploads={droppedUploads}
      />
    </>
  )
}

/**
 * Wraps the body in a whole-sheet dropzone only when the entity can actually hold files.
 *
 * Templates cannot: io2p routes a file's attach target through the engine registry, which knows only
 * objects and processes, so an upload aimed at a template is rejected. Mounting a dropzone that
 * silently discards what it catches is worse than having none.
 */
function MaybeDropzone({
  onFiles,
  editing,
  children,
}: {
  onFiles?: (files: File[]) => void
  editing: boolean
  children: ReactNode
}) {
  if (!onFiles) return <>{children}</>
  return (
    <SheetDropzone
      onFiles={onFiles}
      disabled={!editing}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </SheetDropzone>
  )
}
