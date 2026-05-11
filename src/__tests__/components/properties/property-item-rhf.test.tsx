import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { PropertyItemRHF } from '@/components/properties/property-item-rhf'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('@/components/object-sheets/components', () => ({
  AttachmentList: () => <div data-testid="attachment-list" />,
  AttachmentModal: () => null,
}))

vi.mock('@/components/object-sheets/components/file-display', () => ({
  FileList: () => <div data-testid="file-list" />,
}))

vi.mock('@/components/properties/formula-display', () => ({
  FormulaDisplay: () => <div data-testid="formula-display" />,
}))

vi.mock('@/components/properties/formula-editor', () => ({
  FormulaEditor: () => <div data-testid="formula-editor" />,
}))

vi.mock('@/components/properties/formula-picker', () => ({
  FormulaPicker: () => <div data-testid="formula-picker" />,
}))

vi.mock('@/components/properties/value-mode-toggle', () => ({
  ValueModeToggle: () => <div data-testid="value-mode-toggle" />,
}))

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>()
  return {
    ...actual,
    formatNumericValue: (v: any) => v?.toString() ?? '',
  }
})

const propertySchema = z.object({
  uuid: z.string().optional(),
  key: z.string().min(1, 'Property name is required'),
  values: z.array(
    z.object({
      uuid: z.string().optional(),
      value: z.string(),
      files: z.array(z.any()),
    })
  ),
  files: z.array(z.any()),
})

const formSchema = z.object({
  properties: z.array(propertySchema),
})

type FormValues = z.infer<typeof formSchema>

interface HarnessProps {
  initialKey?: string
  onSubmitInvalid?: () => void
}

function Harness({ initialKey = '', onSubmitInvalid }: HarnessProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      properties: [
        {
          uuid: 'prop-uuid-1',
          key: initialKey,
          values: [{ uuid: 'val-1', value: 'some value', files: [] }],
          files: [],
        },
      ],
    },
  })

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(
          () => undefined,
          () => onSubmitInvalid?.()
        )}
      >
        <PropertyItemRHF name="properties.0" index={0} onRemove={vi.fn()} />
        <button type="submit" data-testid="submit">
          Submit
        </button>
      </form>
    </FormProvider>
  )
}

describe('PropertyItemRHF — name validation', () => {
  it('does not show an error when the form has not been submitted', () => {
    render(<Harness initialKey="" />)

    expect(
      screen.queryByTestId('property-name-error-prop-uuid-1')
    ).not.toBeInTheDocument()
  })

  it('shows the translated error and sets aria-invalid when submit fails with empty key', async () => {
    const onInvalid = vi.fn()
    render(<Harness initialKey="" onSubmitInvalid={onInvalid} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'))
    })

    expect(onInvalid).toHaveBeenCalled()

    const errorEl = await screen.findByTestId('property-name-error-prop-uuid-1')
    expect(errorEl).toHaveTextContent('objects.propertyNameRequired')

    const input = screen.getByTestId('property-name-prop-uuid-1')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the error once the user types a name and resubmits', async () => {
    render(<Harness initialKey="" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'))
    })

    expect(
      await screen.findByTestId('property-name-error-prop-uuid-1')
    ).toBeInTheDocument()

    const input = screen.getByTestId('property-name-prop-uuid-1')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Width' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'))
    })

    expect(
      screen.queryByTestId('property-name-error-prop-uuid-1')
    ).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })
})
