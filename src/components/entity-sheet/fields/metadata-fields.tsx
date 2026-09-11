'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Button, Input, Label, Textarea } from '@/components/ui'
import type { EntityDraft } from '@/lib/entity'
import { cn } from '@/lib/utils'

import { ReadOnlyField } from './read-only-field'

// Past this the description dominates the tab, pushing address and parents below the fold.
const DESCRIPTION_CLAMP_CHARS = 220

const NAME_REQUIRED = 'common.nameRequired'

/**
 * Long text that opens on demand. Truncation is on character count, not a CSS line clamp, so the
 * toggle only appears when there is genuinely something hidden — a clamp can't tell you that.
 */
function ExpandableText({ text }: { text: string }) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)

  if (text.length <= DESCRIPTION_CLAMP_CHARS) {
    return <span className="whitespace-pre-wrap">{text}</span>
  }

  return (
    <div className="space-y-1">
      <span className="whitespace-pre-wrap">
        {expanded
          ? text
          : `${text.slice(0, DESCRIPTION_CLAMP_CHARS).trimEnd()}…`}
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? t('common.showLess') : t('common.showMore')}
      </Button>
    </div>
  )
}

export function MetadataFields({
  form,
  editing,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
}) {
  const t = useTranslations()

  // `useWatch`, NOT `form.watch` — this component receives `form` rather than owning the `useForm`,
  // so a `watch` subscribes the OWNER and this view would keep rendering the value it first saw.
  // Unconditional, because a hook inside the `!editing` branch would change the hook order the
  // moment the sheet enters edit mode.
  const name = useWatch({ control: form.control, name: 'name' })
  const description = useWatch({ control: form.control, name: 'description' })
  // Every sheet raises this on the same field but words it for its own entity, so the key travels
  // in the error rather than being chosen here.
  const nameError = form.formState.errors.name

  if (!editing) {
    return (
      <dl className="space-y-4">
        <ReadOnlyField label={t('objects.fields.name')}>
          {name || '—'}
        </ReadOnlyField>
        <ReadOnlyField label={t('objects.fields.description')}>
          {description ? <ExpandableText text={description} /> : '—'}
        </ReadOnlyField>
      </dl>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label
          htmlFor="entity-name"
          className={cn(nameError && 'text-destructive')}
        >
          {t('objects.fields.name')}
        </Label>
        <Input
          id="entity-name"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'entity-name-error' : undefined}
          {...form.register('name', {
            // A name of spaces passes `required` and the node rejects it anyway.
            validate: (value) => value.trim().length > 0 || NAME_REQUIRED,
          })}
        />
        {nameError && (
          <p
            id="entity-name-error"
            data-testid="entity-name-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {t(nameError.message || NAME_REQUIRED)}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entity-description">
          {t('objects.fields.description')}
        </Label>
        <Textarea
          id="entity-description"
          rows={3}
          {...form.register('description')}
        />
      </div>
    </div>
  )
}
