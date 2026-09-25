import { it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ObjectListPageState } from '@/app/objects/components/use-object-list-page'

const { rendered } = vi.hoisted(() => ({
  rendered: [] as Record<string, unknown>[],
}))

// Every lazily loaded dialog renders as a recorder of its props.
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    rendered.push(props)
    return null
  },
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('@/components/dialogs', () => ({
  DeleteConfirmationDialog: () => null,
}))

import { ObjectRowPortals } from '@/app/objects/components/object-row-portals'

// The share editor limits member levels by the level each seeded item carries, so bulk Share
// must pass it on: the node's verdict where it sent one, `admin` for the author's own rows.
it('seeds bulk Share with the viewer level on each object', () => {
  const state = {
    shareBundleOpen: true,
    shareableObjects: [
      { id: 'o1', name: 'Shared', createdBy: 'them', permission: 'share' },
      { id: 'o2', name: 'Mine', createdBy: 'me' },
    ],
    selectedObjects: [],
    templateFromObject: {},
  } as unknown as ObjectListPageState
  render(<ObjectRowPortals state={state} />)

  const share = rendered.find((p) => 'seedResources' in p)
  expect(share?.seedResources).toEqual([
    { type: 'object', id: 'o1', name: 'Shared', permission: 'share' },
    { type: 'object', id: 'o2', name: 'Mine', permission: 'admin' },
  ])
})
