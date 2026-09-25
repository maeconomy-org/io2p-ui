import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { AuthCarousel } from '@/app/(auth)/components/auth-carousel'
import { AUTH_SCENES } from '@/constants'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const visibleSceneIndex = () => {
  const scenes = screen.getAllByRole('group', { hidden: true })
  return scenes.findIndex((s) => s.getAttribute('aria-hidden') === 'false')
}

describe('AuthCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const advance = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('renders the first scene as the active one on mount', () => {
    render(<AuthCarousel />)
    expect(visibleSceneIndex()).toBe(0)
    AUTH_SCENES.forEach((scene) => {
      expect(
        screen.getByText(`auth.scenes.${scene.id}.title`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`auth.scenes.${scene.id}.description`)
      ).toBeInTheDocument()
    })
  })

  it('auto-advances to the next scene after the rotation interval', async () => {
    render(<AuthCarousel />)
    expect(visibleSceneIndex()).toBe(0)
    await advance(6000)
    expect(visibleSceneIndex()).toBe(1)
    await advance(6000)
    expect(visibleSceneIndex()).toBe(2)
  })

  it('pauses auto-advance while the user hovers the carousel', async () => {
    render(<AuthCarousel />)
    const root = screen.getByTestId('auth-carousel')
    fireEvent.mouseEnter(root)
    await advance(12000)
    expect(visibleSceneIndex()).toBe(0)
    fireEvent.mouseLeave(root)
    await advance(6000)
    expect(visibleSceneIndex()).toBe(1)
  })

  it('does not auto-advance when prefers-reduced-motion is set', async () => {
    setReducedMotion(true)
    render(<AuthCarousel />)
    expect(visibleSceneIndex()).toBe(0)
    await advance(20000)
    expect(visibleSceneIndex()).toBe(0)
  })

  it('jumps to the clicked indicator', () => {
    render(<AuthCarousel />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[2])
    expect(visibleSceneIndex()).toBe(2)
  })
})
