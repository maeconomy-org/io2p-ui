import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { memo } from 'react'

import { MetadataFields } from '@/components/entity-sheet/fields/metadata-fields'
import { AddressField } from '@/components/entity-sheet/fields/address-field'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

/**
 * The production-only failure, reproduced without a production build.
 *
 * `form.watch()` registers a subscription that re-renders whoever OWNS the `useForm`. A component
 * that RECEIVES `form` therefore updates only when its parent happens to re-render it — which in a
 * dev build it usually does, and under the React Compiler it does not. Four shipped bugs were this
 * one line (`property-fields`, `flows-field`, `ObjectFilesField`, `ParentsField`).
 *
 * `memo` is the lever: it freezes the child unless its props change, so a reader that subscribed
 * the OWNER stops updating exactly as it does in a compiled build. A reader using `useWatch` has
 * its own subscription and re-renders regardless.
 */
const FrozenMetadata = memo(function FrozenMetadata({
  form,
}: {
  form: UseFormReturn<EntityDraft>
}) {
  return <MetadataFields form={form} editing={false} />
})

const FrozenAddress = memo(function FrozenAddress({
  form,
}: {
  form: UseFormReturn<EntityDraft>
}) {
  return <AddressField form={form} editing={false} />
})

function Harness({
  Child,
  onReady,
}: {
  Child: typeof FrozenMetadata | typeof FrozenAddress
  /** Hands the form OUT, so the test can write to it without re-rendering this parent — a parent
   *  re-render would refresh the child for the wrong reason and mask the bug. */
  onReady: (form: UseFormReturn<EntityDraft>) => void
}) {
  const form = useForm<EntityDraft>({
    defaultValues: {
      name: 'before',
      description: '',
      parentIds: [],
      properties: [],
      address: { city: 'Rotterdam' } as EntityDraft['address'],
    },
  })
  onReady(form)
  return <Child form={form} />
}

describe('a field that receives `form` re-renders on its own', () => {
  it('MetadataFields shows a name changed after mount', () => {
    let form!: UseFormReturn<EntityDraft>
    render(<Harness Child={FrozenMetadata} onReady={(f) => (form = f)} />)
    expect(screen.getByText('before')).toBeInTheDocument()

    act(() => form.setValue('name', 'after'))

    // With `form.watch` this still read "before": the subscription re-rendered the OWNER, and
    // `memo` kept this child frozen on its first value.
    expect(screen.getByText('after')).toBeInTheDocument()
  })

  it('AddressField shows an address changed after mount', () => {
    let form!: UseFormReturn<EntityDraft>
    render(<Harness Child={FrozenAddress} onReady={(f) => (form = f)} />)
    expect(screen.getByText('Rotterdam')).toBeInTheDocument()

    act(() =>
      form.setValue('address', { city: 'Utrecht' } as EntityDraft['address'])
    )

    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })
})
