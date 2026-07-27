'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Badge,
  Input,
  Label,
  Separator,
  Sheet,
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
import { useTemplates } from '@/hooks/api/entities'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'

import { useTemplateForm } from './hooks/use-template-form'
import { newUploadDraft } from './files'
import {
  EntityFacts,
  MetadataFields,
  ObjectFilesField,
  PropertyFields,
} from './fields'
import {
  DirtyDot,
  SheetLifecycleFooter,
  UnsavedBar,
  countDirtyLeaves,
} from './sheet-lifecycle-footer'

// A template is a recipe, not a measured thing: its values are placeholders, so nothing in it is
// ever server-derived and there is no evaluation trace to show.
const NO_DERIVED_VALUES = new Map<string, never>()

export interface TemplateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Id of the template to view/edit; omit (or null) to create. */
  templateId?: string | null
}

export function TemplateSheet({
  open,
  onOpenChange,
  templateId,
}: TemplateSheetProps) {
  const t = useTranslations()
  const isCreate = !templateId

  const { useGet, useRemove, useRestore } = useTemplates()
  const { data: template, isLoading } = useGet(templateId ?? undefined, {
    enrichFiles: true,
  })
  const loading = !isCreate && (isLoading || !template)

  const [editing, setEditing] = useState(isCreate)
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const lifecycleBusy = removeMutation.isPending || restoreMutation.isPending

  const isDeleted = !!template?.deleted
  // Built-in templates belong to the node, not the user; editing one would be rejected anyway.
  const isSystem = !!template?.system

  const runLifecycle = async (action: 'delete' | 'restore', id: string) => {
    try {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      await mutation.mutateAsync({ id })
      setEditing(false)
    } catch (error) {
      logger.error(`Template ${action} failed`, {
        templateId: id,
        status: iomStatus(error),
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error(t(saveErrorMessage(error).key))
    }
  }

  const { form, submit, isSubmitting } = useTemplateForm(template, {
    onSaved: () => {
      setEditing(false)
      if (isCreate) onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState
  const dirtyCount = countDirtyLeaves(dirtyFields)

  const requestClose = () => {
    if (isDirty && !window.confirm(t('objects.detailsSheet.discardConfirm')))
      return
    onOpenChange(false)
  }

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

  const versionField = (
    <div className="space-y-1.5">
      <Label htmlFor="template-version">{t('objects.fields.version')}</Label>
      {editing ? (
        <Input
          id="template-version"
          placeholder={t('templates.placeholders.version')}
          {...form.register('version')}
        />
      ) : (
        <p className="text-sm">{form.watch('version') || '—'}</p>
      )}
    </div>
  )

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
                ? t('templates.createTitle')
                : loading
                  ? t('common.loading')
                  : (template?.name ?? '')}
            </span>
            {isSystem && (
              <Badge variant="secondary" className="shrink-0">
                {t('templates.systemBadge')}
              </Badge>
            )}
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
            {isCreate ? t('templates.createTitle') : (template?.name ?? '')}
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
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                  <MetadataFields form={form} editing />
                  {versionField}
                  <Separator />
                  <ObjectFilesField
                    form={form}
                    editing
                    allowViewToggle={false}
                    showEmptyState={false}
                  />
                  <Separator />
                  <PropertyFields
                    form={form}
                    editing
                    derivedValues={NO_DERIVED_VALUES}
                    label={t('objects.fields.properties')}
                  />
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
                              dirtyFields.version
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
                        derivedValues={NO_DERIVED_VALUES}
                      />
                    </TabsContent>
                    <TabsContent value="files" className="mt-0">
                      <ObjectFilesField
                        form={form}
                        editing={editing}
                        entityId={template?.id}
                      />
                    </TabsContent>
                    <TabsContent value="details" className="mt-0 space-y-4">
                      {template && <EntityFacts entity={template} />}
                      <MetadataFields form={form} editing={editing} />
                      {versionField}
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
                canDelete={!!template && !isSystem}
                onEdit={() => setEditing(true)}
                onCancel={cancel}
                onDelete={() =>
                  template && void runLifecycle('delete', template.id)
                }
                onRestore={() =>
                  template && void runLifecycle('restore', template.id)
                }
              />
            </form>
          </SheetDropzone>
        )}
      </SheetContent>
    </Sheet>
  )
}
