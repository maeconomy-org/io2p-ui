import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'

import { MetadataFields } from '@/components/entity-sheet/fields/metadata-fields'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

function Harness({
  onReady,
}: {
  onReady: (form: UseFormReturn<EntityDraft>) => void
}) {
  const form = useForm<EntityDraft>({
    defaultValues: {
      name: 'Wall A',
      description: null,
      address: null,
      parentIds: [],
      properties: [],
    },
  })
  onReady(form)
  return <MetadataFields form={form} editing />
}

function setup() {
  let form!: UseFormReturn<EntityDraft>
  render(<Harness onReady={(f) => (form = f)} />)
  return {
    form,
    input: () => screen.getByLabelText('objects.fields.name'),
  }
}

/**
 * A refused save used to move focus and say nothing. The field is the only place a user can act on
 * the refusal, so the reason has to be there too — the toast is gone in seconds.
 */
describe('MetadataFields name error', () => {
  it('shows nothing until the field is refused', () => {
    const { input } = setup()
    expect(input()).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the message the sheet chose, tied to the input', () => {
    const { form, input } = setup()

    act(() =>
      form.setError('name', {
        type: 'required',
        message: 'objects.saveError.nameRequired',
      })
    )

    const message = screen.getByRole('alert')
    expect(message).toHaveTextContent('objects.saveError.nameRequired')
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAttribute('aria-describedby', message.id)
  })

  // Templates raise the same error without a key, and a blank message would render an empty line.
  it('falls back to a generic message when the sheet named none', () => {
    const { form } = setup()

    act(() => form.setError('name', { type: 'required' }))

    expect(screen.getByRole('alert')).toHaveTextContent('common.nameRequired')
  })

  it('refuses a name of only spaces', async () => {
    const { form, input } = setup()

    fireEvent.change(input(), { target: { value: '   ' } })
    await act(async () => {
      await form.trigger('name')
    })

    expect(screen.getByRole('alert')).toHaveTextContent('common.nameRequired')
  })

  it('clears once a real name is typed', async () => {
    const { form, input } = setup()

    act(() => form.setError('name', { type: 'required' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(input(), { target: { value: 'Wall B' } })
    await act(async () => {
      await form.trigger('name')
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
