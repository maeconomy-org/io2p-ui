/**
 * What the wizard says when the node refuses the envelope.
 *
 * Nothing was written, so this list is the whole account of what went wrong — there is no status
 * page to go on to, and the user's next move is to fix the mapping. Two things were missing from
 * it: the field the node names when it knows one, and any sign that the list was truncated.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ImportProblem } from 'io2p-client'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { StepImport } from '@/app/import/components/wizard/step-import'
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'

const wizard = (count: number) =>
  ({
    items: Array.from({ length: count }, (_, i) => ({
      sourceRef: String(i + 2),
    })),
    file: null,
  }) as unknown as ImportWizard

const problem = (over: Partial<ImportProblem> = {}): ImportProblem =>
  ({ seq: 0, message: 'must be a string', ...over }) as ImportProblem

function renderRefused(problems: ImportProblem[]) {
  render(
    <StepImport
      wizard={wizard(problems.length + 1)}
      phase="refused"
      progress={{ phase: 'idle', staged: 0, total: 0 }}
      problems={problems}
      error={null}
    />
  )
}

describe('a refused import', () => {
  it('names the field the node blamed', () => {
    renderRefused([problem({ field: 'parents' })])

    expect(screen.getByText('parents')).toBeInTheDocument()
  })

  // `body` is the node's word for "the item as a whole", not a column anyone mapped. The row
  // prefix already identifies the item, so printing it would add a field name the user cannot
  // find in their file.
  it('says nothing when the whole item was refused', () => {
    renderRefused([problem({ field: 'body' })])

    expect(screen.queryByText('body')).toBeNull()
  })

  // The node sends `field` only "when known". With none, the line is the row and the message and
  // nothing between them — an empty element there would show as a stray gap mid-sentence.
  it('leaves the line alone when the node named no field', () => {
    renderRefused([problem({ seq: 0, message: 'must be a string' })])

    const line = screen.getByTestId('run-refused').querySelector('li')
    expect(line?.textContent).toBe(
      'import.run.rowPrefix:{"row":"2"}: must be a string'
    )
  })

  // Eight rows and no total read as "eight problems" whatever the real number was — the one
  // figure that decides whether this is a typo or a broken mapping.
  it('counts the refusals it did not list', () => {
    renderRefused(Array.from({ length: 11 }, (_, i) => problem({ seq: i })))

    expect(screen.getByTestId('run-more')).toHaveTextContent('3')
  })

  it('counts nothing when every refusal is listed', () => {
    renderRefused(Array.from({ length: 8 }, (_, i) => problem({ seq: i })))

    expect(screen.queryByTestId('run-more')).toBeNull()
  })
})
