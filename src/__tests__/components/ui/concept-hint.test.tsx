import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ConceptHint } from '@/components/ui/concept-hint'
import en from '@/messages/en.json'
import nl from '@/messages/nl.json'

describe('ConceptHint', () => {
  it('exposes an accessible name, since the trigger is icon-only', () => {
    render(<ConceptHint label="What is a share?">A bundle.</ConceptHint>)

    expect(
      screen.getByRole('button', { name: 'What is a share?' })
    ).toBeInTheDocument()
  })

  it('does not submit the form it is rendered inside', () => {
    // Hints sit next to field labels; a bare <button> defaults to type=submit.
    render(
      <form>
        <ConceptHint label="How does the hierarchy work?">Parents.</ConceptHint>
      </form>
    )

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('keeps the explanation hidden until asked for', () => {
    render(<ConceptHint label="What is a draft?">Device-local.</ConceptHint>)

    expect(screen.queryByText('Device-local.')).not.toBeInTheDocument()
  })

  it('reveals the explanation on hover', async () => {
    const user = userEvent.setup()
    render(
      <ConceptHint label="What is a constant?">
        Pinned at bind time.
      </ConceptHint>
    )

    await user.hover(screen.getByRole('button'))

    expect(await screen.findByText('Pinned at bind time.')).toBeInTheDocument()
  })
})

describe('concept copy', () => {
  const CONCEPTS = [
    'share',
    'formula',
    'constant',
    'draft',
    'parent',
    'deleted',
  ] as const

  it('defines a label and body for every concept, in both locales', () => {
    for (const key of CONCEPTS) {
      for (const [name, bundle] of [
        ['en', en],
        ['nl', nl],
      ] as const) {
        const entry = (bundle.concepts as Record<string, unknown>)[key] as {
          label?: string
          body?: string
        }
        expect(entry, `${name}.concepts.${key} missing`).toBeDefined()
        expect(
          entry.label?.length,
          `${name}.${key}.label empty`
        ).toBeGreaterThan(0)
        expect(entry.body?.length, `${name}.${key}.body empty`).toBeGreaterThan(
          0
        )
      }
    }
  })

  it('phrases every label as a question, so the ⓘ reads as one', () => {
    for (const key of CONCEPTS) {
      const { label } = (en.concepts as Record<string, { label: string }>)[key]
      expect(label.endsWith('?'), `en.${key}.label: "${label}"`).toBe(true)
    }
  })
})
