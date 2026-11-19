import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  DuplicateObjectsSheet,
  type DuplicateSourceObject,
} from '@/app/objects/components/duplicate-objects/duplicate-objects-sheet'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects: { list: () => new Promise(() => {}) } }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

function renderSheet(sources: DuplicateSourceObject[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DuplicateObjectsSheet
        open
        onOpenChange={vi.fn()}
        preselectedObjects={sources}
      />
    </QueryClientProvider>
  )
}

const includeChildren = () => screen.queryByTestId('duplicate-include-children')

describe('DuplicateObjectsSheet and the child counts', () => {
  it('offers to copy the children of a source whose count the node did not read', () => {
    renderSheet([{ uuid: 'a', name: 'A' }])
    expect(includeChildren()).toBeInTheDocument()
  })

  it('prints no child total when a count in it is unknown', () => {
    renderSheet([
      { uuid: 'a', name: 'A' },
      { uuid: 'b', name: 'B', childCount: 3 },
    ])
    fireEvent.click(includeChildren()!)
    expect(screen.queryByTestId('duplicate-child-total')).toBeNull()
  })

  it('says more than 1,000 children for a capped count', () => {
    renderSheet([{ uuid: 'a', name: 'A', childCount: 1001 }])
    fireEvent.click(includeChildren()!)
    expect(screen.getByTestId('duplicate-child-total')).toHaveTextContent(
      'objects.duplicate.childCountMoreThan:{"count":1000}'
    )
  })

  it('adds each capped count as more than 1,000, as the picker footer does', () => {
    renderSheet([
      { uuid: 'a', name: 'A', childCount: 1001 },
      { uuid: 'b', name: 'B', childCount: 1001 },
      { uuid: 'c', name: 'C', childCount: 4 },
    ])
    fireEvent.click(includeChildren()!)
    expect(screen.getByTestId('duplicate-child-total')).toHaveTextContent(
      'objects.duplicate.childCountMoreThan:{"count":2004}'
    )
  })

  it('offers no children choice for a leaf', () => {
    renderSheet([{ uuid: 'a', name: 'A', childCount: 0 }])
    expect(includeChildren()).toBeNull()
  })
})
