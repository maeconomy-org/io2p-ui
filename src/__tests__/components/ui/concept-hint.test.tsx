import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ConceptHint } from '@/components/ui/concept-hint'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : walk(full)
    }
    return /\.tsx?$/.test(entry) ? [full] : []
  })

/** Every source file, concatenated — for "is this concept referenced anywhere". */
const sources = walk(join(process.cwd(), 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

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
  // One per page that has a help control — the inline hints were removed, so a
  // concept with no page is dead copy.
  const CONCEPTS = [
    'object',
    'process',
    'share',
    'template',
    'formula',
    'constant',
    'import',
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

  it('defines no concept that nothing renders', () => {
    // Inline hints were removed in favour of one control per page heading, which
    // orphaned three concepts. This fails if that happens again.
    const used = new Set(
      [...sources.matchAll(/concept="(\w+)"/g)].map((m) => m[1])
    )
    expect([...Object.keys(en.concepts)].sort()).toEqual([...used].sort())
  })

  it('phrases every label as a question, so the ⓘ reads as one', () => {
    for (const key of CONCEPTS) {
      const { label } = (en.concepts as Record<string, { label: string }>)[key]
      expect(label.endsWith('?'), `en.${key}.label: "${label}"`).toBe(true)
    }
  })
})

describe('ConceptHint unread dot', () => {
  it('draws no dot by default', () => {
    render(<ConceptHint label="What is a share?">A bundle.</ConceptHint>)
    expect(screen.queryByTestId('concept-hint-unread')).not.toBeInTheDocument()
  })

  it('draws the dot when unread', () => {
    render(
      <ConceptHint label="What is a share?" unread>
        A bundle.
      </ConceptHint>
    )
    expect(screen.getByTestId('concept-hint-unread')).toBeInTheDocument()
  })

  /**
   * The dot is decorative and carries its meaning in the button's NAME instead.
   * An `sr-only` span inside the button would be silent, because `aria-label`
   * overrides inner content — and the dot would then be colour-only.
   */
  it('carries the unread state in the accessible name, not in colour', () => {
    render(
      <ConceptHint label="What is a share?" unread unreadLabel="Not read yet">
        A bundle.
      </ConceptHint>
    )

    expect(screen.getByTestId('concept-hint-unread')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'What is a share? — Not read yet' })
    ).toBeInTheDocument()
  })

  it('leaves the name alone once read', () => {
    render(
      <ConceptHint label="What is a share?" unreadLabel="Not read yet">
        A bundle.
      </ConceptHint>
    )
    expect(
      screen.getByRole('button', { name: 'What is a share?' })
    ).toBeInTheDocument()
  })

  it('reports opening on hover', async () => {
    const onOpenChange = vi.fn()
    render(
      <ConceptHint label="What is a share?" onOpenChange={onOpenChange}>
        A bundle.
      </ConceptHint>
    )

    await userEvent.hover(screen.getByRole('button'))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true))
  })

  // Keyboard users must be able to clear the dot too.
  it('reports opening on focus', async () => {
    const onOpenChange = vi.fn()
    render(
      <ConceptHint label="What is a share?" onOpenChange={onOpenChange}>
        A bundle.
      </ConceptHint>
    )

    screen.getByRole('button').focus()

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true))
  })
})
