'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { CreateTemplateInput } from 'io2p-client'

import { Badge, Input, Label, Separator } from '@/components/ui'
import { useTemplates } from '@/hooks/api/entities'

import { useTemplateForm } from './hooks/use-template-form'
import { useEntityLifecycle } from './hooks/use-entity-lifecycle'
import { EntitySheetShell, type SheetTab } from './entity-sheet-shell'
import {
  EntityFacts,
  FlowsField,
  MetadataFields,
  PropertyFields,
} from './fields'
import {
  SheetLifecycleFooter,
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
  /** Open straight into edit mode — for an "Edit" row action, which otherwise lands on the read view. */
  initialEditing?: boolean
  /**
   * Which kind to CREATE. Ignored when editing — the loaded template's own type wins, since changing
   * it would reinterpret every property the author already wrote.
   */
  type?: NonNullable<CreateTemplateInput['type']>
}

export function TemplateSheet({
  open,
  onOpenChange,
  templateId,
  initialEditing = false,
  type = 'object',
}: TemplateSheetProps) {
  const t = useTranslations()
  const isCreate = !templateId

  const templates = useTemplates()
  const { data: template, isLoading } = templates.useGet(
    templateId ?? undefined,
    { enrichFiles: true }
  )
  const loading = !isCreate && (isLoading || !template)

  const [editing, setEditing] = useState(isCreate || initialEditing)
  const lifecycle = useEntityLifecycle(templates, 'Template', () =>
    setEditing(false)
  )

  const isDeleted = !!template?.deleted
  // Built-in templates belong to the node, not the user; editing one would be rejected anyway.
  const isSystem = !!template?.system

  // The loaded template's own type is authoritative; `type` only decides what a CREATE will be.
  const templateType = template?.type ?? type
  const isProcess = templateType === 'process'

  const { form, submit, isSubmitting } = useTemplateForm(template, {
    type: templateType,
    onSaved: () => {
      setEditing(false)
      if (isCreate) onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState

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

  // Details first, then flows — the same order the process sheet uses, so a process template reads
  // like the thing it scaffolds rather than like its own kind of screen.
  const tabs: SheetTab[] = [
    {
      value: 'details',
      label: t('objects.detailsSheet.tabDetails'),
      dirty: !!(
        dirtyFields.name ||
        dirtyFields.description ||
        dirtyFields.version
      ),
      content: (
        <div className="space-y-4">
          {template && <EntityFacts entity={template} />}
          <MetadataFields form={form} editing={editing} />
          {versionField}
        </div>
      ),
    },
    {
      value: 'properties',
      label: t('objects.fields.properties'),
      dirty: !!dirtyFields.properties,
      content: (
        <PropertyFields
          form={form}
          editing={editing}
          derivedValues={NO_DERIVED_VALUES}
          allowFiles={false}
        />
      ),
    },
    ...(isProcess
      ? (['inputs', 'outputs'] as const).map((bag) => ({
          value: bag,
          label: t(`processes.flows.${bag}`),
          dirty: !!dirtyFields[bag],
          content: (
            <FlowsField
              form={form}
              bag={bag}
              editing={editing}
              derivedValues={NO_DERIVED_VALUES}
              optionalRef
            />
          ),
        }))
      : []),
  ]

  return (
    <EntitySheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        isCreate
          ? t('templates.createTitle')
          : loading
            ? t('common.loading')
            : (template?.name ?? '')
      }
      badges={
        <>
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
        </>
      }
      loading={loading}
      editing={editing}
      isDirty={isDirty}
      dirtyCount={countDirtyLeaves(dirtyFields)}
      onSubmit={submit}
      tabs={isCreate ? undefined : tabs}
      footer={(guardUnsaved) => (
        <SheetLifecycleFooter
          editing={editing}
          isCreate={isCreate}
          isDeleted={isDeleted}
          isDirty={isDirty}
          isSubmitting={isSubmitting}
          lifecycleBusy={lifecycle.isBusy}
          canDelete={!!template && !isSystem}
          onEdit={() => setEditing(true)}
          onCancel={() => guardUnsaved(cancel)}
          onDelete={() => template && void lifecycle.run('delete', template.id)}
          onRestore={() =>
            template && void lifecycle.run('restore', template.id)
          }
        />
      )}
    >
      <div className="space-y-4">
        <MetadataFields form={form} editing />
        {versionField}
        <Separator />
        <PropertyFields
          form={form}
          editing
          derivedValues={NO_DERIVED_VALUES}
          label={t('objects.fields.properties')}
          allowFiles={false}
        />
        {isProcess &&
          (['inputs', 'outputs'] as const).map((bag) => (
            <div key={bag} className="space-y-2">
              <Separator />
              <Label>{t(`processes.flows.${bag}`)}</Label>
              <FlowsField
                form={form}
                bag={bag}
                editing
                derivedValues={NO_DERIVED_VALUES}
                optionalRef
              />
            </div>
          ))}
      </div>
    </EntitySheetShell>
  )
}
