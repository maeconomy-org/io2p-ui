import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  FloatingActionBar,
  FloatingActionBarSeparator,
} from '@/components/ui/floating-action-bar'

describe('FloatingActionBar', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <FloatingActionBar open={false} label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('exposes its actions when open', () => {
    render(
      <FloatingActionBar open label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('labels the region, since it appears without the user navigating to it', () => {
    render(
      <FloatingActionBar open label="Selection actions">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(
      screen.getByRole('region', { name: 'Selection actions' })
    ).toBeInTheDocument()
  })

  it('floats out of the layout flow so showing it shifts nothing', () => {
    // The whole reason this exists rather than an inline bar: an inline one pushes the rows or chart
    // below it down the moment a selection happens, moving what the user was aiming at.
    render(
      <FloatingActionBar open label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(screen.getByRole('region')).toHaveClass('fixed')
  })

  it('stacks below sheets and dialogs', () => {
    // Opening a detail sheet from the bar must cover it; a z-50 bar would float over the overlay.
    render(
      <FloatingActionBar open label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(screen.getByRole('region')).toHaveClass('z-40')
  })

  it('lets clicks through its empty gutter but not through the bar', () => {
    render(
      <FloatingActionBar open label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    const region = screen.getByRole('region')
    expect(region).toHaveClass('pointer-events-none')
    expect(region.firstElementChild).toHaveClass('pointer-events-auto')
  })

  it('honours reduced motion', () => {
    render(
      <FloatingActionBar open label="Selection">
        <button type="button">Delete</button>
      </FloatingActionBar>
    )

    expect(screen.getByRole('region').firstElementChild).toHaveClass(
      'motion-reduce:animate-none'
    )
  })

  it('renders a decorative separator that screen readers skip', () => {
    const { container } = render(<FloatingActionBarSeparator />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
