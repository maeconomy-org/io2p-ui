import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { CoverImage } from 'io2p-client'

import { CoverCell } from '@/components/entity-list/cover-cell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const THUMB = 'https://example.test/thumb.webp?sig=abc'

// `CoverImage` reuses the file-ref shape, so `kind` is required even though a cover is always an
// upload — the server rejects a reference by construction.
const cover = (extra: Partial<CoverImage> = {}): CoverImage => ({
  id: 'f1',
  kind: 'upload',
  ...extra,
})

describe('CoverCell', () => {
  describe('placeholder', () => {
    it.each([
      ['no cover at all', undefined],
      ['an explicit null', null],
      // A cover whose derive worker has not run yet has nothing to show. Rendering a broken image
      // would read as an error; the placeholder reads as "none chosen", which is closer to true.
      ['a cover with no thumbnail yet', cover()],
    ])('renders the placeholder for %s', (_case, cover) => {
      render(<CoverCell cover={cover} name="North wall" />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('keeps the placeholder out of the accessibility tree', () => {
      // Every row without a cover would otherwise announce the same nothing, and the entity's name
      // is in the very next cell.
      const { container } = render(<CoverCell cover={null} />)
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('with a cover', () => {
    it('renders the thumbnail behind a labelled trigger', () => {
      render(
        <CoverCell cover={cover({ thumbnailUrl: THUMB })} name="North wall" />
      )
      const trigger = screen.getByRole('button')
      expect(trigger).toHaveAccessibleName(/North wall/)
      expect(screen.getByRole('presentation')).toHaveAttribute('src', THUMB)
    })

    it('gives the row image an empty alt, since the trigger is already labelled', () => {
      render(<CoverCell cover={cover({ thumbnailUrl: THUMB })} name="Wall" />)
      // alt="" makes it presentational; a duplicate name here would be announced twice.
      expect(screen.getByRole('presentation')).toHaveAttribute('alt', '')
    })

    it('is the same size as the placeholder', () => {
      // A column that changes height as covers load makes the whole table jump.
      const { container: withCover } = render(
        <CoverCell cover={cover({ thumbnailUrl: THUMB })} />
      )
      const { container: without } = render(<CoverCell cover={null} />)
      const size = (el: Element | null) =>
        (el as HTMLElement).className.match(/h-\d+ w-\d+/)?.[0]
      expect(size(withCover.querySelector('button'))).toBe(
        size(without.firstChild as Element)
      )
    })
  })
})
