'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { Label, Separator } from '@/components/ui'
import { anchor } from '@/constants'
import type { EntityDraft } from '@/lib/entity'
import { templatePresetToDraftProperties } from '@/lib/entity'

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
const NO_DERIVED_VALUES = new Map<string, never>()

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
    // Carries preset data, formula recipes and the refs those recipes bind to — not just the keys.
    form.setValue(
      'properties',
      templatePresetToDraftProperties(choice.properties),
      { shouldDirty: true }
    )
  }

  return (
    <div className="space-y-4">
      {/* Identity: what this object is and where it sits. Kept tight — these read as one block. */}
      <Field
        label={t('objects.templateSelector.label')}
        htmlFor="entity-template"
        {...anchor('sheetTemplate')}
      >
        <TemplateSelector selected={template} onSelect={applyTemplate} />
      </Field>

      <Field
        label={t('objects.detailsSheet.tabParents')}
        {...anchor('sheetParents')}
      >
        <ParentsField form={form} editing parentNames={parentNames} />
      </Field>

      <div {...anchor('sheetMetadata')}>
        <MetadataFields form={form} editing />
      </div>

      <Separator />
      <div {...anchor('sheetAddress')}>
        <AddressField form={form} editing />
      </div>

      <Separator />
      {/* No grid toggle while creating: nothing is uploaded yet, so there are no thumbnails. */}
      <div {...anchor('sheetFiles')}>
        <ObjectFilesField
          form={form}
          editing
          allowViewToggle={false}
          showEmptyState={false}
        />
      </div>

      <Separator />
      <div {...anchor('sheetProperties')}>
        <PropertyFields
          form={form}
          editing
          derivedValues={NO_DERIVED_VALUES}
          label={t('objects.fields.properties')}
        />
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
  ...rest
}: {
  label: string
  htmlFor?: string
  children: ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="space-y-1.5" {...rest}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
