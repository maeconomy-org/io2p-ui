// Columns past the viewport edge are the ones a click just created, so the row
// the user asked for is the one they cannot see. jsdom reports 0 for every
// layout value, so the assertions pin the CALL, not a pixel offset.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'

type ColumnCapture = {
  parentId: string
  title: string
  onSelect: (item: { id: string; childCount?: number }) => void
}
const columnProps: ColumnCapture[] = []

vi.mock('@/app/objects/components/columns-view/components', () => ({
  MillerColumn: (props: ColumnCapture) => {
    columnProps.push(props)
    return null
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ObjectColumnsView } from '@/app/objects/components/columns-view'

const actions = {
  onViewObject: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onShowQRCode: vi.fn(),
  onCreateTemplate: vi.fn(),
  onRestore: vi.fn(),
}

function mockReducedMotion(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  )
}

describe('ObjectColumnsView scrolling', () => {
  let scrollTo: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    columnProps.length = 0
    scrollTo = vi.spyOn(Element.prototype, 'scrollTo')
    mockReducedMotion(false)
  })

  afterEach(() => {
    scrollTo.mockRestore()
  })

  it('scrolls to the end when opening a child column', () => {
    render(<ObjectColumnsView {...actions} />)
    scrollTo.mockClear()

    act(() => {
      columnProps[0].onSelect({ id: 'child-1', childCount: 2 })
    })

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    )
  })

  it('does not scroll when the selected item opens no column', () => {
    render(<ObjectColumnsView {...actions} />)
    scrollTo.mockClear()

    act(() => {
      columnProps[0].onSelect({ id: 'leaf-1', childCount: 0 })
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('jumps without animation when the user asks for reduced motion', () => {
    mockReducedMotion(true)
    render(<ObjectColumnsView {...actions} />)
    scrollTo.mockClear()

    act(() => {
      columnProps[0].onSelect({ id: 'child-1', childCount: 2 })
    })

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    )
  })
})
