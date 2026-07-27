'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { Label, Separator } from '@/components/ui'
import type { EntityDraft } from '@/lib/entity-body'

import {
  AddressField,
  MetadataFields,
  ObjectFilesField,
  ParentsField,
  PropertyFields,
  TemplateSelector,
  type TemplateChoice,
} from './fields'

// A brand-new object has no derived values — nothing has been computed server-side yet.
const EMPTY_DERIVED_IDS = new Set<string>()

/**
 * The CREATE shell: one scrolling column, in the order the work actually happens.
 *
 * Deliberately not the tabbed edit shell. Creating is linear over something that doesn't exist yet,
 * so every section needs to be seen — and tabs actively hid the required Name behind an inactive tab
 * (Radix unmounts inactive content, so validation couldn't even focus it and Save appeared to do
 * nothing). Editing is random-access over something that already exists, which is what tabs are for.
 *
 * The form and the write-body builder are shared with the edit shell; only the presentation differs.
 */
export function CreateForm({
  form,
  parentNames,
}: {
  form: UseFormReturn<EntityDraft>
  parentNames: Map<string, string>
}) {
  const t = useTranslations()
  const [template, setTemplate] = useState<TemplateChoice | null>(null)

  const applyTemplate = (choice: TemplateChoice | null) => {
    setTemplate(choice)
    if (!choice) return
    // Don't clobber a name the user already typed — the template is a starting point, not a reset.
    if (!form.getValues('name').trim()) {
      form.setValue('name', choice.name, { shouldDirty: true })
    }
    if (choice.description) {
      form.setValue('description', choice.description, { shouldDirty: true })
    }
    form.setValue(
      'properties',
      (choice.properties ?? []).map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description,
        // A template supplies the shape; the values are for this object to fill in.
        values: [{ data: '', ref: crypto.randomUUID() }],
      })),
      { shouldDirty: true }
    )
  }

  return (
    <div className="space-y-4">
      {/* Identity: what this object is and where it sits. Kept tight — these read as one block. */}
      <Field
        label={t('objects.templateSelector.label')}
        htmlFor="entity-template"
      >
        <TemplateSelector selected={template} onSelect={applyTemplate} />
      </Field>

      <Field label={t('objects.detailsSheet.tabParents')}>
        <ParentsField form={form} editing parentNames={parentNames} />
      </Field>

      <MetadataFields form={form} editing />

      <Separator />
      <AddressField form={form} editing />

      <Separator />
      {/* No grid toggle while creating: nothing is uploaded yet, so there are no thumbnails. */}
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
        derivedValueIds={EMPTY_DERIVED_IDS}
        label={t('objects.fields.properties')}
      />
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
