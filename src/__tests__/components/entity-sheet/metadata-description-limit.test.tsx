import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'

import { MAX_DESCRIPTION_CHARS } from '@/constants'
import { MetadataFields } from '@/components/entity-sheet/fields/metadata-fields'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}))

function Harness({
  description,
  onReady,
}: {
  description: string | null
  onReady: (form: UseFormReturn<EntityDraft>) => void
}) {
  const form = useForm<EntityDraft>({
    defaultValues: {
      name: 'Wall A',
      description,
      address: null,
      parentIds: [],
      properties: [],
    },
  })
  onReady(form)
  return <MetadataFields form={form} editing />
}

function setup(description: string | null) {
  let form!: UseFormReturn<EntityDraft>
  render(<Harness description={description} onReady={(f) => (form = f)} />)
  return {
    form,
    input: () => screen.getByLabelText('objects.fields.description'),
    counter: () => screen.getByTestId('char-counter'),
  }
}

describe('MetadataFields description limit', () => {
  it('shows the count against the limit, tied to the input', () => {
    const { input, counter } = setup('Clay 😀')
    expect(counter()).toHaveTextContent(
      `charCount {"count":6,"max":${MAX_DESCRIPTION_CHARS}}`
    )
    expect(input().getAttribute('aria-describedby')).toContain(counter().id)
  })

  it('says "too long" in words for an old description over the limit', () => {
    const { counter } = setup('a'.repeat(MAX_DESCRIPTION_CHARS + 5))
    expect(counter()).toHaveTextContent('charCountOver')
  })

  it('shows the refusal, and clears it once the text fits again', () => {
    const { form, input } = setup('a'.repeat(MAX_DESCRIPTION_CHARS + 1))
    act(() =>
      form.setError('description', {
        type: 'maxLength',
        message: 'common.descriptionTooLong',
      })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'common.descriptionTooLong'
    )
    expect(input()).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(input(), { target: { value: 'short' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
