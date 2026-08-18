'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Badge, Label } from '@/components/ui'
import { canDelete, canEdit } from '@/components/entity-list'
import { useProcesses } from '@/hooks/api/entities'
import type { EntityDraft, ValueProvenance } from '@/lib/entity'
import { templatePresetToDraftProperties } from '@/lib/entity'
import { anchor } from '@/constants'

import { useProcessForm } from './hooks/use-process-form'
import { useEntityLifecycle } from './hooks/use-entity-lifecycle'
import { EntitySheetShell, type SheetTab } from './entity-sheet-shell'
import { newUploadDraft } from './files'
import {
  EntityFacts,
  FlowsField,
  MetadataFields,
  ObjectFilesField,
  PropertyFields,
  TemplateSelector,
  type TemplateChoice,
} from './fields'
import {
  SheetLifecycleFooter,
  countDirtyLeaves,
} from './sheet-lifecycle-footer'

export interface ProcessSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Id of the process to view/edit; omit (or null) to create. */
  processId?: string | null
  /** Open straight into edit mode — for an "Edit" row action. */
  initialEditing?: boolean
}

export function ProcessSheet({
  open,
  onOpenChange,
  processId,
  initialEditing = false,
}: ProcessSheetProps) {
  const t = useTranslations()
  const isCreate = !processId

  const processes = useProcesses()
  const { data: process, isLoading } = processes.useGet(
    processId ?? undefined,
    { enrichFiles: true, includeDeleted: true }
  )
  const loading = !isCreate && (isLoading || !process)

  const [editing, setEditing] = useState(isCreate || initialEditing)
  const [template, setTemplate] = useState<TemplateChoice | null>(null)
  const isDeleted = !!process?.deleted
  const permission = process?.permission
  const editable = canEdit(permission)

  // `initialEditing` comes from the row's Edit action, and it is applied before the fetch resolves —
  // so a viewer who may not write would already be sitting in a live form by the time the node's
  // verdict arrives. Corrected here rather than gated at `useState`, where `permission` is always
  // undefined.
  //
  // Keyed on `editable` alone, NOT on `process`: a refetch hands back a new object on every cache
  // update, and re-running there would drop a viewer out of a form they are part-way through.
  useEffect(() => {
    if (!isCreate && !editable) setEditing(false)
  }, [isCreate, editable])
  const lifecycle = useEntityLifecycle(processes, 'Process', () =>
    setEditing(false)
  )

  const { form, submit, isSubmitting } = useProcessForm(process, {
    onSaved: () => {
      setEditing(false)
      if (isCreate) onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState
  const draft = form.watch()

  /**
   * A process is ONE entity for calc purposes: D76 makes a derived value's siblings span the
   * process's own properties AND every flow, so the formula picker is fed the union rather than
   * whichever bag it happens to sit in.
   */
  const allProperties = useMemo<EntityDraft['properties']>(
    () => [
      ...(draft.properties ?? []),
      ...(draft.inputs ?? []).flatMap((f) => f.properties ?? []),
      ...(draft.outputs ?? []).flatMap((f) => f.properties ?? []),
    ],
    [draft]
  )

  // Keyed by value id across the whole aggregate, flows included — a flow value can be derived too.
  const derivedValues = useMemo(() => {
    const m = new Map<string, ValueProvenance | undefined>()
    const collect = (
      props?: {
        values: { id: string; source?: string; provenance?: ValueProvenance }[]
      }[]
    ) =>
      props?.forEach((p) =>
        p.values.forEach((v) => {
          if (v.source === 'derived') m.set(v.id, v.provenance)
        })
      )
    collect(process?.properties)
    process?.inputs?.forEach((f) => collect(f.properties))
    process?.outputs?.forEach((f) => collect(f.properties))
    return m
  }, [process])

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

  /**
   * Start from a template. Offered on CREATE only — applying one to an existing process would
   * overwrite properties and flows the user already has, which is a different (destructive) action
   * than "start from this shape".
   *
   * A template's flow `ref` is a SUGGESTED default and is often absent, so a slot arrives as an
   * empty row for the user to fill rather than being dropped.
   */
  const applyTemplate = (choice: TemplateChoice | null) => {
    setTemplate(choice)
    if (!choice) return

    // Never clobber a name already typed — a template is a starting point, not a reset.
    if (!form.getValues('name').trim()) {
      form.setValue('name', choice.name, { shouldDirty: true })
    }
    if (choice.description) {
      form.setValue('description', choice.description, { shouldDirty: true })
    }
    form.setValue(
      'properties',
      templatePresetToDraftProperties(choice.properties),
      { shouldDirty: true }
    )

    for (const bag of ['inputs', 'outputs'] as const) {
      form.setValue(
        bag,
        (choice[bag] ?? []).map((flow) => ({
          ref: flow.ref ?? '',
          properties: templatePresetToDraftProperties(flow.properties),
        })),
        { shouldDirty: true }
      )
    }
  }

  // Details first: it carries the most at a glance. Flows follow in the order a process reads.
  const detailsTab = (
    <div className="space-y-4">
      {process && <EntityFacts entity={process} />}
      {isCreate && (
        <div className="space-y-1.5" {...anchor('sheetTemplate')}>
          <Label>{t('objects.templateSelector.label')}</Label>
          <TemplateSelector
            type="process"
            selected={template}
            onSelect={applyTemplate}
          />
        </div>
      )}
      {/* Anchored for the create-process tour. The names are the SHARED sheet
          section names, not process-specific ones — the object sheet marks the
          same sections, and a tour step reads the same either way. */}
      <div {...anchor('sheetMetadata')}>
        <MetadataFields form={form} editing={editing} />
      </div>
      <div {...anchor('sheetProperties')}>
        <PropertyFields
          form={form}
          editing={editing}
          derivedValues={derivedValues}
          siblingSource={allProperties}
          label={t('objects.fields.properties')}
        />
      </div>
    </div>
  )

  const flowsDirty = (bag: 'inputs' | 'outputs') =>
    !!dirtyFields[bag] && countDirtyLeaves(dirtyFields[bag]) > 0

  const tabs: SheetTab[] = [
    {
      value: 'details',
      label: t('objects.detailsSheet.tabDetails'),
      dirty: !!(
        dirtyFields.name ||
        dirtyFields.description ||
        dirtyFields.properties
      ),
      content: detailsTab,
    },
    {
      value: 'files',
      label: t('objects.filesTitle'),
      dirty: !!dirtyFields.files,
      content: (
        <ObjectFilesField
          form={form}
          editing={editing}
          entityId={process?.id}
        />
      ),
    },
    {
      value: 'inputs',
      label: t('processes.flows.inputs'),
      dirty: flowsDirty('inputs'),
      content: (
        <FlowsField
          form={form}
          bag="inputs"
          editing={editing}
          siblingSource={allProperties}
          derivedValues={derivedValues}
          entityId={process?.id}
        />
      ),
    },
    {
      value: 'outputs',
      label: t('processes.flows.outputs'),
      dirty: flowsDirty('outputs'),
      content: (
        <FlowsField
          form={form}
          bag="outputs"
          editing={editing}
          siblingSource={allProperties}
          derivedValues={derivedValues}
          entityId={process?.id}
        />
      ),
    },
  ]

  return (
    <EntitySheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        isCreate
          ? t('processes.create')
          : loading
            ? t('common.loading')
            : (process?.name ?? '')
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
      dirtyCount={countDirtyLeaves(dirtyFields)}
      onFiles={dropFiles}
      onSubmit={submit}
      tabs={tabs}
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
          canDelete={!!process && canDelete(permission)}
          entityName={process?.name}
          onEdit={() => setEditing(true)}
          onCancel={() => guardUnsaved(cancel)}
          onDelete={() => process && void lifecycle.run('delete', process.id)}
          onRestore={() => process && void lifecycle.run('restore', process.id)}
        />
      )}
    />
  )
}
