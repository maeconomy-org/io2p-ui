'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDropzone,
  SheetDescription,
  SheetFooter,
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
import { logger } from '@/lib'

import { useEntityForm } from './hooks/use-entity-form'
import { CreateForm } from './create-form'
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

function DirtyDot({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
  )
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
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const derivedValueIds = useMemo(() => {
    const s = new Set<string>()
    entity?.properties?.forEach((p) =>
      p.values.forEach((v) => {
        if (v.source === 'derived') s.add(v.id)
      })
    )
    return s
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
                        derivedValueIds={derivedValueIds}
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

              {isDirty && (
                <div className="flex items-center gap-2 border-t bg-muted/40 px-6 py-2 text-sm">
                  <span className="font-medium">
                    {t('objects.detailsSheet.unsavedChanges', {
                      count: dirtyCount,
                    })}
                  </span>
                </div>
              )}

              <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
                {isDeleted ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={lifecycleBusy}
                    onClick={() => entity && runLifecycle('restore', entity.id)}
                  >
                    {lifecycleBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    {t('common.restore')}
                  </Button>
                ) : !editing ? (
                  <>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </Button>
                    {!isCreate && entity && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={lifecycleBusy}
                        onBlur={() => setConfirmDelete(false)}
                        onClick={() => {
                          if (!confirmDelete) return setConfirmDelete(true)
                          setConfirmDelete(false)
                          void runLifecycle('delete', entity.id)
                        }}
                      >
                        {confirmDelete ? (
                          t('common.confirm')
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('common.delete')}
                          </>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={cancel}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isSubmitting || !isDirty}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t('common.save')}
                    </Button>
                  </>
                )}
              </SheetFooter>
            </form>
          </SheetDropzone>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * How many individual fields the user has actually changed. `dirtyFields` mirrors the value shape,
 * so arrays and objects nest — counting its top-level keys would call twelve edited properties
 * "1 unsaved change".
 */
export function countDirtyLeaves(node: unknown): number {
  if (node === true) return 1
  if (Array.isArray(node)) {
    return node.reduce<number>((n, child) => n + countDirtyLeaves(child), 0)
  }
  if (node && typeof node === 'object') {
    return Object.values(node).reduce<number>(
      (n, child) => n + countDirtyLeaves(child),
      0
    )
  }
  return 0
}
