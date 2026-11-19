import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

import { StepCheck } from '@/app/import/components/wizard/step-check'
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

const pickerProps = vi.fn()

// The picker has its own tests; here only what the destination asks of it matters.
vi.mock('@/components/entity-sheet/fields', () => ({
  ObjectPicker: (props: { requireLinkable?: boolean }) => {
    pickerProps(props)
    return null
  },
}))

const emptyWizard = {
  items: [],
  dataRows: [],
  problems: [],
  destination: null,
  setDestination: vi.fn(),
} as unknown as ImportWizard

describe('StepCheck destination', () => {
  it('offers only objects the viewer may import under', () => {
    render(<StepCheck wizard={emptyWizard} />)

    expect(pickerProps).toHaveBeenCalledWith(
      expect.objectContaining({ requireLinkable: true })
    )
  })
})
