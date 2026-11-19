import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DraftRows } from '@/components/drafts/draft-rows'
import type { DraftIndexEntry } from '@/hooks/drafts'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

const DRAFTS: DraftIndexEntry[] = [
  { id: 'draft_1', name: 'North wall', updatedAt: 1_700_000_000_000 },
  { id: 'draft_2', name: '', updatedAt: 1_700_000_001_000 },
]

function renderRows(drafts = DRAFTS) {
  const onResume = vi.fn()
  const onDiscard = vi.fn()
  const view = render(
    <table>
      <tbody>
        <DraftRows
          drafts={drafts}
          colSpan={5}
          onResume={onResume}
          onDiscard={onDiscard}
        />
      </tbody>
    </table>
  )
  return { ...view, onResume, onDiscard }
}

describe('DraftRows', () => {
  it('renders one row per draft, spanning the whole grid', () => {
    renderRows()
    const rows = screen.getAllByTestId('draft-row')
    expect(rows).toHaveLength(2)
    // One spanning cell, not a cell per column: a draft has no owner/created/child-count values,
    // and a fixed cell layout would break when the column toggle hides one.
    expect(rows[0].querySelectorAll('td')).toHaveLength(1)
    expect(rows[0].querySelector('td')).toHaveAttribute('colspan', '5')
  })

  it('falls back to a placeholder name for an unnamed draft', () => {
    renderRows()
    expect(screen.getByText('North wall')).toBeInTheDocument()
    expect(screen.getByText('objects.drafts.untitled')).toBeInTheDocument()
  })

  it('renders nothing at all when there are no drafts', () => {
    renderRows([])
    expect(screen.queryByTestId('draft-row')).not.toBeInTheDocument()
  })

  // Same EntityActionsCell every other table row uses — primary button plus dropdown — so a draft
  // row's actions look and behave like an object's.
  it('resumes from the primary action button', () => {
    const { onResume } = renderRows()
    fireEvent.click(screen.getAllByTestId('draft-details-button')[0])
    expect(onResume).toHaveBeenCalledWith('draft_1')
  })

  it('resumes on double-click, matching how a real row opens', () => {
    const { onResume } = renderRows()
    fireEvent.doubleClick(screen.getAllByTestId('draft-row')[1])
    expect(onResume).toHaveBeenCalledWith('draft_2')
  })

  // Discarding a draft is unrecoverable — it lives only in this browser, so there is no server copy
  // to restore from. That is exactly why it confirms first.
  it('confirms before discarding, and does not discard until confirmed', async () => {
    const { onDiscard } = renderRows()
    // userEvent, not fireEvent: Radix opens the menu on a full pointer sequence, which fireEvent's
    // single synthetic event does not produce. setup.ts polyfills the rest of what jsdom lacks.
    const user = userEvent.setup()

    await user.click(screen.getAllByTestId('draft-actions-dropdown')[0])
    await user.click(await screen.findByTestId('draft-action-discard'))
    expect(onDiscard).not.toHaveBeenCalled()

    await user.click(screen.getByText('objects.drafts.discardConfirm.confirm'))
    expect(onDiscard).toHaveBeenCalledWith('draft_1')
  })
})
