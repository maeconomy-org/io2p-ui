import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ImageViewer } from '@/components/entity-sheet/file-viewers/image-viewer'

function setup(
  overrides: Partial<React.ComponentProps<typeof ImageViewer>> = {}
) {
  const onZoom = vi.fn()
  const onToggleZoom = vi.fn()
  render(
    <ImageViewer
      src="blob:stub"
      alt="pic"
      scale={1}
      rotation={0}
      onZoom={onZoom}
      onToggleZoom={onToggleZoom}
      {...overrides}
    />
  )
  return { onZoom, onToggleZoom }
}

describe('ImageViewer', () => {
  it('renders the image with scale + rotation applied', () => {
    setup({ scale: 2, rotation: 90 })
    const img = screen.getByAltText('pic') as HTMLImageElement
    expect(img.style.transform).toBe('scale(2) rotate(90deg)')
  })

  it('zooms in when the user ctrl+scrolls up', () => {
    const { onZoom } = setup()
    const img = screen.getByAltText('pic')
    fireEvent.wheel(img.parentElement!, { deltaY: -100, ctrlKey: true })
    expect(onZoom).toHaveBeenCalledTimes(1)
    expect(onZoom.mock.calls[0][0]).toBeGreaterThan(1)
  })

  it('zooms out when the user ctrl+scrolls down', () => {
    const { onZoom } = setup()
    const img = screen.getByAltText('pic')
    fireEvent.wheel(img.parentElement!, { deltaY: 100, ctrlKey: true })
    expect(onZoom).toHaveBeenCalledTimes(1)
    expect(onZoom.mock.calls[0][0]).toBeLessThan(1)
  })

  it('ignores plain scrolls without ctrl/meta', () => {
    const { onZoom } = setup()
    const img = screen.getByAltText('pic')
    fireEvent.wheel(img.parentElement!, { deltaY: -100 })
    expect(onZoom).not.toHaveBeenCalled()
  })

  it('toggles zoom on double-click', () => {
    const { onToggleZoom } = setup()
    const img = screen.getByAltText('pic')
    fireEvent.doubleClick(img.parentElement!)
    expect(onToggleZoom).toHaveBeenCalledTimes(1)
  })

  it('shows a loading spinner instead of the image when isLoading', () => {
    setup({ isLoading: true, src: '' })
    expect(screen.queryByAltText('pic')).not.toBeInTheDocument()
  })
})
