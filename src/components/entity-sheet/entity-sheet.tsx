'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Badge, Label } from '@/components/ui'
import { useObjects } from '@/hooks/api/entities'
import { useObjectDrafts } from '@/hooks/drafts'
import { hasPendingUploads, type ValueProvenance } from '@/lib/entity-body'

import { useEntityForm } from './hooks/use-entity-form'
import { useEntityLifecycle } from './hooks/use-entity-lifecycle'
import { CreateForm } from './create-form'
import { EntitySheetShell, type SheetTab } from './entity-sheet-shell'
import {
  SheetLifecycleFooter,
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
  /** Resume a locally-stored draft. Create flow only — an existing entity is its own source. */
  draftId?: string | null
}

export function EntitySheet({
  open,
  onOpenChange,
  entityId,
  defaultParentIds,
  defaultParentNames,
  draftId,
}: EntitySheetProps) {
  const t = useTranslations()
  const isCreate = !entityId

  const objects = useObjects()
  const { data: entity, isLoading } = objects.useGet(
    entityId ?? undefined,
    // Ask for soft-deleted sub-items so they render struck-through with a Restore action, rather
    // than silently vanishing — nothing is destroyed, so nothing should look destroyed.
    { enrichFiles: true, includeDeleted: true }
  )
  const loading = !isCreate && (isLoading || !entity)

  const [editing, setEditing] = useState(isCreate)

  // A soft-deleted object is shown, not hidden — but it can't be edited until it's restored.
  const isDeleted = !!entity?.deleted
  const lifecycle = useEntityLifecycle(objects, 'Object', () =>
    setEditing(false)
  )

  const drafts = useObjectDrafts()
  const { getDraft } = drafts
  const resumeDraft = useMemo(() => {
    if (!isCreate || !draftId) return null
    const draft = getDraft(draftId)
    return draft ? { id: draftId, draft } : null
  }, [isCreate, draftId, getDraft])

  const { form, submit, isSubmitting } = useEntityForm(entity, {
    defaultParentIds,
    resumeDraft,
    onSaved: () => {
      setEditing(false)
      if (!isCreate) return
      // The object exists on the server now, so the local copy is no longer a draft of anything.
      if (draftId) drafts.deleteDraft(draftId)
      onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState

  const saveAsDraft = () => {
    const values = form.getValues()
    const id = draftId ?? drafts.newDraftId()
    drafts.saveDraft(
      id,
      values,
      values.name.trim() || t('objects.drafts.untitled')
    )
    toast.success(t('objects.drafts.saved'))
  }

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

  const tabs: SheetTab[] = [
    {
      value: 'properties',
      label: t('objects.fields.properties'),
      dirty: !!dirtyFields.properties,
      content: (
        <PropertyFields
          form={form}
          editing={editing}
          derivedValues={derivedValues}
        />
      ),
    },
    {
      value: 'files',
      label: t('objects.filesTitle'),
      dirty: !!dirtyFields.files,
      content: (
        <ObjectFilesField form={form} editing={editing} entityId={entity?.id} />
      ),
    },
    {
      value: 'details',
      label: t('objects.detailsSheet.tabDetails'),
      dirty: !!(
        dirtyFields.name ||
        dirtyFields.description ||
        dirtyFields.address ||
        dirtyFields.parentIds
      ),
      content: (
        <div className="space-y-4">
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
        </div>
      ),
    },
  ]

  return (
    <EntitySheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        isCreate
          ? t('objects.create')
          : loading
            ? t('common.loading')
            : (entity?.name ?? '')
      }
      badges={
        isDeleted && (
          <Badge
            variant="outline"
            className="shrink-0 border-destructive text-destructive"
          >
            {t('common.deleted')}
          </Badge>
        )
      }
      loading={loading}
      editing={editing}
      isDirty={isDirty}
      // RHF mirrors the value shape, so a top-level key count reports twelve edited properties as
      // one change. Count the leaves instead.
      dirtyCount={countDirtyLeaves(dirtyFields)}
      onFiles={dropFiles}
      onSubmit={submit}
      onSaveDraft={isCreate ? saveAsDraft : undefined}
      droppedUploads={isCreate && hasPendingUploads(form.getValues())}
      tabs={isCreate ? undefined : tabs}
      footer={(guardUnsaved) => (
        <SheetLifecycleFooter
          editing={editing}
          isCreate={isCreate}
          isDeleted={isDeleted}
          isDirty={isDirty}
          isSubmitting={isSubmitting}
          lifecycleBusy={lifecycle.isBusy}
          canDelete={!!entity}
          onEdit={() => setEditing(true)}
          onCancel={() => guardUnsaved(cancel)}
          onDelete={() => entity && void lifecycle.run('delete', entity.id)}
          onRestore={() => entity && void lifecycle.run('restore', entity.id)}
        />
      )}
    >
      <CreateForm form={form} parentNames={parentNames} />
    </EntitySheetShell>
  )
}

export { countDirtyLeaves } from './sheet-lifecycle-footer'
