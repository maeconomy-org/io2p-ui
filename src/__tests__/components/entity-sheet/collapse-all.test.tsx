import React from 'react'
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import {
  CollapseAllContext,
  useCollapseAll,
  useCollapsible,
  useFilesDisclosure,
} from '@/components/entity-sheet/collapse-all'

describe('Collapse all', () => {
  it('closes a part that was open, and lets it open again', () => {
    const { result } = renderHook(() => useCollapseAll())
    const part = renderHook(() => useCollapsible(), {
      wrapper: ({ children }) =>
        React.createElement(
          CollapseAllContext.Provider,
          { value: result.current.generation },
          children
        ),
    })

    act(() => part.result.current[1](true))
    expect(part.result.current[0]).toBe(true)

    act(() => result.current.collapse())
    part.rerender()
    expect(part.result.current[0]).toBe(false)

    act(() => part.result.current[1](true))
    expect(part.result.current[0]).toBe(true)
  })

  it('counts up on every press, so a second press closes what opened in between', () => {
    const { result } = renderHook(() => useCollapseAll())

    act(() => result.current.collapse())
    act(() => result.current.collapse())
    expect(result.current.generation).toBe(2)
  })
})

describe('a card with files inside', () => {
  it('opens the card when its files are opened from the header', () => {
    const { result } = renderHook(() => useFilesDisclosure())

    act(() => result.current.toggleFiles())
    expect(result.current.filesOpen).toBe(true)
    expect(result.current.open).toBe(true)
  })

  it('closes only the files on a second press, leaving the card open', () => {
    const { result } = renderHook(() => useFilesDisclosure())

    act(() => result.current.toggleFiles())
    act(() => result.current.toggleFiles())
    expect(result.current.filesOpen).toBe(false)
    expect(result.current.open).toBe(true)
  })

  it('opens card and list in one click after the card was closed with the list open', () => {
    const { result } = renderHook(() => useFilesDisclosure())

    act(() => result.current.toggleFiles())
    act(() => result.current.setOpen(false))
    // Hidden with its card, so it does not claim to be open.
    expect(result.current.filesOpen).toBe(false)

    act(() => result.current.toggleFiles())
    expect(result.current.open).toBe(true)
    expect(result.current.filesOpen).toBe(true)
  })
})
