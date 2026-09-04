import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ConstantDTO } from 'io2p-client'

import { ConstantSheet } from '@/app/constants/components/constant-sheet'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({ dateTime: () => '3 Jul 2026' }),
}))

const createMutate = vi.fn()
const appendMutate = vi.fn()
vi.mock('@/hooks/api/leaves', () => ({
  useConstants: () => ({
    useCreate: () => ({ mutateAsync: createMutate, isPending: false }),
    useAppendVersion: () => ({ mutateAsync: appendMutate, isPending: false }),
  }),
}))

vi.mock('@/components/entity-list', async () => {
  const { canWriteLibraryItem } =
    await import('@/components/entity-list/ownership')
  return { OwnerCell: () => <span>owner</span>, canWriteLibraryItem }
})

const VIEWER = 'u-1'
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: VIEWER }) }))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const CONSTANT = {
  id: 'c-1',
  name: 'co2_factor',
  system: false,
  ownerUserId: 'u-1',
  versions: [
    { version: 1, data: '0.38', num: 0.38, ts: 1 },
    { version: 2, data: '0.40', num: 0.4, ts: 2 },
    { version: 3, data: '0.42', num: 0.42, ts: 3 },
  ],
} as ConstantDTO

const nameInput = () => screen.getByLabelText('constants.name')
const valueInput = () => screen.getByLabelText(/constants\.(new)?[Vv]alue/)
const saveButton = () =>
  screen.getByRole('button', { name: /constants\.(create|addVersion)/ })

describe('ConstantSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMutate.mockResolvedValue({ id: 'c-2' })
    appendMutate.mockResolvedValue({ id: 'c-1' })
  })

  it('creates with a name and a first value', async () => {
    render(<ConstantSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(nameInput(), { target: { value: 'density' } })
    fireEvent.change(valueInput(), { target: { value: '2400 kg' } })
    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({
        body: { name: 'density', data: '2400 kg' },
      })
    )
  })

  it('APPENDS a version when editing, rather than updating in place', async () => {
    // The whole point of the type: earlier versions are immutable, and a calc that pinned one keeps
    // resolving to it. An update would silently move every formula bound to this constant.
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )
    fireEvent.change(valueInput(), { target: { value: '0.45' } })
    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(appendMutate).toHaveBeenCalledWith({
        id: 'c-1',
        body: { data: '0.45' },
      })
    )
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('seeds the field with the current value, not the first', () => {
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )

    expect(valueInput()).toHaveValue('0.42')
  })

  it('locks the name once it exists, since a binding records it', () => {
    // Renaming would orphan every calc bound to the old name.
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )

    expect(nameInput()).toBeDisabled()
  })

  it('will not append an unchanged value', () => {
    // Otherwise Save mints a duplicate version that changes nothing.
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )

    expect(saveButton()).toBeDisabled()
  })

  it('lists every version, newest first', () => {
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )

    const versions = screen.getAllByText(/^v\d$/).map((n) => n.textContent)
    expect(versions).toEqual(['v3', 'v2', 'v1'])
  })

  it('says that existing formulas keep their pinned version', () => {
    // Without this on screen, appending reads as "my edit did nothing".
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={CONSTANT}
      />
    )

    expect(screen.getAllByText('constants.pinnedNote').length).toBeGreaterThan(
      0
    )
  })

  it('flags a version that did not normalize', () => {
    // A value with no number can never feed a calc; silence would make it look usable.
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={
          {
            ...CONSTANT,
            versions: [
              {
                version: 1,
                data: 'about ten',
                ts: 1,
                parse: { ok: false, normVersion: 1, reason: 'no-number' },
              },
            ],
          } as ConstantDTO
        }
      />
    )

    expect(screen.getByText('constants.notNumeric')).toBeInTheDocument()
  })

  it('is read-only for a built-in, which belongs to the node', () => {
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={{ ...CONSTANT, system: true } as ConstantDTO}
      />
    )

    // Omitted, not greyed: a disabled input still offers a control the viewer cannot use.
    expect(screen.queryByLabelText(/constants\.(new)?[Vv]alue/)).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'constants.addVersion' })
    ).toBeNull()
  })

  it('is read-only for a constant someone else owns, which is shared read-only', () => {
    render(
      <ConstantSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        constant={{ ...CONSTANT, ownerUserId: 'someone-else' } as ConstantDTO}
      />
    )

    // Omitted, not greyed: a disabled input still offers a control the viewer cannot use.
    expect(screen.queryByLabelText(/constants\.(new)?[Vv]alue/)).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'constants.addVersion' })
    ).toBeNull()
  })
})
