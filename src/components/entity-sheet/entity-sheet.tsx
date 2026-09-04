'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Badge, Label } from '@/components/ui'
import { canDelete, canEdit } from '@/components/entity-list'
import { useAuth } from '@/contexts/auth-context'
import { OBJECT_DETAIL_READ, useObjects } from '@/hooks/api/entities'
import { useObjectDrafts } from '@/hooks/drafts'
import { hasPendingUploads, type ValueProvenance } from '@/lib/entity'
import type { EntityRollupEntry } from 'io2p-client'

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
  RelationsField,
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
  const router = useRouter()
  const isCreate = !entityId

  const objects = useObjects()
  const { userId } = useAuth()
  // OBJECT_DETAIL_READ, not a literal: the hover prefetch keys on these exact options.
  const { data: entity, isLoading } = objects.useGet(
    entityId ?? undefined,
    OBJECT_DETAIL_READ
  )
  const loading = !isCreate && (isLoading || !entity)

  const [editing, setEditing] = useState(isCreate)

  // A soft-deleted object is shown, not hidden — but it can't be edited until it's restored.
  const isDeleted = !!entity?.deleted
  // The node's own verdict, so a viewer shared at `write` keeps Edit while one shared at `read`
  // loses it — an ownership test would get the first of those wrong. Absent on a create, and on a
  // node predating the field, where the ladder reads it as unrestricted.
  const permission = entity?.permission
  const editable = canEdit(permission)
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
    onSaved: (_id, addedParents) => {
      setEditing(false)
      announceReparent(addedParents)
      if (!isCreate) return
      // The object exists on the server now, so the local copy is no longer a draft of anything.
      if (draftId) drafts.deleteDraft(draftId)
      onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty: formIsDirty } = form.formState
  /**
   * A RESUMED draft is unsaved work by definition, even before it is touched.
   *
   * It loads as the form's own defaults, so RHF reports it clean — and Save is gated on dirtiness,
   * which left a resumed draft unsavable until the user edited something arbitrary.
   */
  const isDirty = formIsDirty || !!resumeDraft

  const saveAsDraft = () => {
    const values = form.getValues()
    const id = draftId ?? drafts.newDraftId()
    const saved = drafts.saveDraft(
      id,
      values,
      values.name.trim() || t('objects.drafts.untitled')
    )
    // A draft keys on the signed-in id, so one saved before `/me` resolves has nowhere to go. It
    // used to report success either way, and the work was simply not there afterwards.
    if (saved) toast.success(t('objects.drafts.saved'))
    else toast.error(t('objects.drafts.saveFailed'))
  }

  // Subtree totals, keyed by the node's already-lowercased `propertyKey` so the read view can join
  // on `property.key.toLowerCase()`.
  //
  // Gated on OWNERSHIP, not on `permission`: the node serves this owner-only and answers a
  // non-owner with 404, so a `write` or even `admin` grantee must not ask. `canEdit` is the wrong
  // test here for the same reason it is the right one for Edit.
  const isOwner = !!entity && !!userId && entity.createdBy === userId
  const { data: rollupData } = objects.useRollups(entityId ?? undefined, {
    enabled: isOwner,
  })
  const rollups = useMemo(() => {
    const m = new Map<string, EntityRollupEntry>()
    rollupData?.data.forEach((entry) => m.set(entry.propertyKey, entry))
    return m
  }, [rollupData])

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

  // Held HERE, not in `ParentsField`: a name resolved by the picker has to outlive that component's
  // render so the post-save toast can name the parent the object just moved under.
  const [pickedParentNames, setPickedParentNames] = useState<
    Record<string, string>
  >({})

  const parentNames = useMemo(() => {
    const m = new Map<string, string>(Object.entries(defaultParentNames ?? {}))
    entity?.parents?.forEach((p) => {
      if (p.name) m.set(p.id, p.name)
    })
    Object.entries(pickedParentNames).forEach(([id, name]) => m.set(id, name))
    return m
  }, [entity, defaultParentNames, pickedParentNames])

  // Separate from `parentNames` on purpose: that map answers "what is this called", and the
  // reparent toast reads it. Delete is non-cascading, so a live child legitimately keeps a link to
  // a tombstoned parent — the chip has to say so rather than render it like any other parent.
  const deletedParentIds = useMemo(
    () =>
      new Set(
        (entity?.parents ?? []).filter((p) => p.deleted).map((p) => p.id)
      ),
    [entity]
  )

  /**
   * Say where the object went. `/objects` lists ROOTS, so linking a parent removes the row the user
   * was looking at — correct, and silent without this.
   */
  const announceReparent = (addedParents: string[]) => {
    const first = addedParents[0]
    if (!first) return
    const name =
      parentNames.get(first) ?? t('objects.parents.movedFallbackName')
    const wasRoot = (entity?.parents?.length ?? 0) === 0
    toast.success(
      wasRoot
        ? t('objects.parents.movedUnder', { name })
        : t('objects.parents.alsoUnder', { name }),
      {
        action: {
          label: t('objects.parents.openParent'),
          onClick: () => {
            onOpenChange(false)
            router.push(`/objects/${first}`)
          },
        },
      }
    )
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
          rollups={rollups}
        />
      ),
    },
    {
      value: 'files',
      label: t('objects.filesTitle'),
      dirty: !!dirtyFields.files,
      content: (
        <ObjectFilesField
          form={form}
          editing={editing}
          entityId={entity?.id}
          allowCover
        />
      ),
    },
    {
      value: 'relations',
      label: t('objects.detailsSheet.tabRelations'),
      // Nothing here is editable, so this tab can never hold an unsaved change of its own.
      dirty: false,
      // ...but leaving for /processes abandons whatever OTHER tabs have edited, so the exit runs
      // through the same guard Cancel and Escape do.
      content: (guardUnsaved) => (
        <RelationsField
          entityId={entity?.id}
          onViewAll={
            entity
              ? () =>
                  guardUnsaved(() => {
                    onOpenChange(false)
                    router.push(`/processes?ref=${entity.id}`)
                  })
              : undefined
          }
        />
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
              deletedParentIds={deletedParentIds}
              onParentPicked={(id, name) =>
                setPickedParentNames((m) => ({ ...m, [id]: name }))
              }
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
          canEdit={editable}
          // Its own rung: delete and restore are guarded at `admin`, so a write grantee edits but
          // does not delete.
          canDelete={!!entity && canDelete(permission)}
          entityName={entity?.name}
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
