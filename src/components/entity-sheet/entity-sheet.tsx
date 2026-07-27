'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Badge,
  Sheet,
  SheetContent,
  SheetDropzone,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { useObjects } from '@/hooks/api/entities'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import type { ValueProvenance } from '@/lib/entity-body'
import { logger } from '@/lib'

import { useEntityForm } from './hooks/use-entity-form'
import { CreateForm } from './create-form'
import {
  DirtyDot,
  SheetLifecycleFooter,
  UnsavedBar,
  countDirtyLeaves,
} from './sheet-lifecycle-footer'
import { newUploadDraft } from './files'
import {
  AddressField,
  EntityFacts,
  MetadataFields,
  ObjectFilesField,
  ParentsField,
  PropertyFields,
} from './fields'

export interface EntitySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Id of the entity to view/edit; omit (or null) to create. The full aggregate is fetched here. */
  entityId?: string | null
  /** Parents to preset on a create draft (the "add child" flow). */
  defaultParentIds?: string[]
  /**
   * Names for `defaultParentIds`. A create draft has no fetched entity to read parent names from,
   * so without these the preset parent renders as a bare UUID.
   */
  defaultParentNames?: Record<string, string>
}

export function EntitySheet({
  open,
  onOpenChange,
  entityId,
  defaultParentIds,
  defaultParentNames,
}: EntitySheetProps) {
  const t = useTranslations()
  const isCreate = !entityId

  const { data: entity, isLoading } = useObjects().useGet(
    entityId ?? undefined,
    // Ask for soft-deleted sub-items so they render struck-through with a Restore action, rather
    // than silently vanishing — nothing is destroyed, so nothing should look destroyed.
    { enrichFiles: true, includeDeleted: true }
  )
  const loading = !isCreate && (isLoading || !entity)

  const [editing, setEditing] = useState(isCreate)
  const { useRemove, useRestore } = useObjects()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  // A soft-deleted object is shown, not hidden — but it can't be edited until it's restored.
  const isDeleted = !!entity?.deleted
  const lifecycleBusy = removeMutation.isPending || restoreMutation.isPending

  const runLifecycle = async (
    action: 'delete' | 'restore',
    id: string
  ): Promise<void> => {
    try {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      await mutation.mutateAsync({ id })
      setEditing(false)
    } catch (error) {
      logger.error(`Object ${action} failed`, {
        entityId: id,
        status: iomStatus(error),
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error(t(saveErrorMessage(error).key))
    }
  }

  const { form, submit, isSubmitting } = useEntityForm(entity, {
    defaultParentIds,
    onSaved: () => {
      setEditing(false)
      if (isCreate) onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState
  // RHF mirrors the value shape, so a top-level key count reports twelve edited properties as one
  // change. Count the leaves instead.
  const dirtyCount = countDirtyLeaves(dirtyFields)

  // Keyed by value id: presence means the value is derived, the payload is the node's evaluation
  // trace. A derived value always has a source; `provenance` is what it was computed FROM.
  const derivedValues = useMemo(() => {
    const m = new Map<string, ValueProvenance | undefined>()
    entity?.properties?.forEach((p) =>
      p.values.forEach((v) => {
        if (v.source === 'derived') m.set(v.id, v.provenance)
      })
    )
    return m
  }, [entity])

  const parentNames = useMemo(() => {
    const m = new Map<string, string>(Object.entries(defaultParentNames ?? {}))
    entity?.parents?.forEach((p) => {
      if (p.name) m.set(p.id, p.name)
    })
    return m
  }, [entity, defaultParentNames])

  const requestClose = () => {
    if (isDirty && !window.confirm(t('objects.detailsSheet.discardConfirm')))
      return
    onOpenChange(false)
  }

  // Dropping anywhere in the sheet attaches at OBJECT level — the coarsest, least surprising target
  // when the pointer wasn't over a particular property or value.
  const dropFiles = (dropped: File[]) => {
    if (!editing || dropped.length === 0) return
    form.setValue(
      'files',
      [...(form.getValues('files') ?? []), ...dropped.map(newUploadDraft)],
      { shouldDirty: true }
    )
    toast.success(t('objects.files.addedCount', { count: dropped.length }))
  }

  const cancel = () => {
    form.reset()
    if (isCreate) onOpenChange(false)
    else setEditing(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
    >
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <span className="min-w-0 truncate">
              {isCreate
                ? t('objects.create')
                : loading
                  ? t('common.loading')
                  : (entity?.name ?? '')}
            </span>
            {isDeleted && (
              <Badge
                variant="outline"
                className="shrink-0 border-destructive text-destructive"
              >
                {t('common.deleted')}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isCreate ? t('objects.create') : (entity?.name ?? '')}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex-1 space-y-3 px-6 py-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}

        {!loading && (
          <SheetDropzone
            onFiles={dropFiles}
            disabled={!editing}
            className="flex min-h-0 flex-1 flex-col"
          >
            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              {isCreate ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <CreateForm form={form} parentNames={parentNames} />
                </div>
              ) : (
                <Tabs
                  defaultValue="properties"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="px-6 pt-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="properties">
                        {t('objects.fields.properties')}
                        <DirtyDot show={!!dirtyFields.properties} />
                      </TabsTrigger>
                      <TabsTrigger value="files">
                        {t('objects.filesTitle')}
                        <DirtyDot show={!!dirtyFields.files} />
                      </TabsTrigger>
                      <TabsTrigger value="details">
                        {t('objects.detailsSheet.tabDetails')}
                        <DirtyDot
                          show={
                            !!(
                              dirtyFields.name ||
                              dirtyFields.description ||
                              dirtyFields.address ||
                              dirtyFields.parentIds
                            )
                          }
                        />
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <TabsContent value="properties" className="mt-0">
                      <PropertyFields
                        form={form}
                        editing={editing}
                        derivedValues={derivedValues}
                      />
                    </TabsContent>
                    <TabsContent value="files" className="mt-0">
                      <ObjectFilesField
                        form={form}
                        editing={editing}
                        entityId={entity?.id}
                      />
                    </TabsContent>
                    <TabsContent value="details" className="mt-0 space-y-4">
                      {/* Identity first — what this object IS, before what it says about itself. */}
                      {entity && <EntityFacts entity={entity} />}
                      <MetadataFields form={form} editing={editing} />
                      <AddressField form={form} editing={editing} />
                      <div className="space-y-1.5">
                        <Label>{t('objects.detailsSheet.tabParents')}</Label>
                        <ParentsField
                          form={form}
                          editing={editing}
                          parentNames={parentNames}
                          selfId={entity?.id}
                        />
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              )}

              {isDirty && <UnsavedBar count={dirtyCount} />}

              <SheetLifecycleFooter
                editing={editing}
                isCreate={isCreate}
                isDeleted={isDeleted}
                isDirty={isDirty}
                isSubmitting={isSubmitting}
                lifecycleBusy={lifecycleBusy}
                canDelete={!!entity}
                onEdit={() => setEditing(true)}
                onCancel={cancel}
                onDelete={() =>
                  entity && void runLifecycle('delete', entity.id)
                }
                onRestore={() =>
                  entity && void runLifecycle('restore', entity.id)
                }
              />
            </form>
          </SheetDropzone>
        )}
      </SheetContent>
    </Sheet>
  )
}

export { countDirtyLeaves } from './sheet-lifecycle-footer'
