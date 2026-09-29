import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { FilesControl } from '@/components/entity-sheet/files/files-control'

function renderControl(
  props: Partial<React.ComponentProps<typeof FilesControl>> = {}
) {
  const onToggle = vi.fn()
  const onAttach = vi.fn()
  render(
    <FilesControl
      variant="field"
      count={0}
      open={false}
      onToggle={onToggle}
      controls="list-1"
      label="Files on this value"
      onAttach={onAttach}
      attachTestId="attach-1"
      {...props}
    />
  )
  return { onToggle, onAttach }
}

describe('the one files control', () => {
  it('attaches when there is nothing to list', () => {
    const { onAttach, onToggle } = renderControl()

    fireEvent.click(screen.getByTestId('attach-1'))
    expect(onAttach).toHaveBeenCalledOnce()
    expect(onToggle).not.toHaveBeenCalled()
    expect(screen.queryByTestId('files-toggle')).not.toBeInTheDocument()
  })

  it('lists when there are files, named for a screen reader with the count', () => {
    const { onAttach, onToggle } = renderControl({ count: 2, open: true })

    const toggle = screen.getByRole('button', {
      name: 'Files on this value (2)',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', 'list-1')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledOnce()
    expect(onAttach).not.toHaveBeenCalled()
    expect(screen.queryByTestId('attach-1')).not.toBeInTheDocument()
  })

  it('shows nothing for an empty thing in read mode', () => {
    const { container } = render(
      <FilesControl
        variant="row"
        count={0}
        open={false}
        onToggle={vi.fn()}
        controls="list-1"
        label="Files on this flow"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('attaches from a header too', () => {
    const { onAttach } = renderControl({ variant: 'row' })

    fireEvent.click(screen.getByTestId('attach-1'))
    expect(onAttach).toHaveBeenCalledOnce()
  })
})
