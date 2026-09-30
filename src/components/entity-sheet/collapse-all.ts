'use client'

import { createContext, useCallback, useContext, useState } from 'react'

/**
 * A counter the read view bumps to close everything open under it. Zero outside a read view, so a
 * part rendered anywhere else behaves as a plain toggle.
 */
export const CollapseAllContext = createContext(0)

type SetOpen = (next: boolean | ((open: boolean) => boolean)) => void

/**
 * An open/closed toggle that "Collapse all" can close. The state remembers the counter it was set
 * under; once the counter moves on, the part reads as closed until it is opened again. Derived
 * this way rather than reset in an effect, so there is never a frame where it is still open.
 */
export function useCollapsible(): [boolean, SetOpen] {
  const generation = useContext(CollapseAllContext)
  const [state, setState] = useState({ open: false, generation })
  const open = state.generation === generation && state.open
  const setOpen = useCallback<SetOpen>(
    (next) =>
      setState((s) => {
        const current = s.generation === generation && s.open
        return {
          open: typeof next === 'function' ? next(current) : next,
          generation,
        }
      }),
    [generation]
  )
  return [open, setOpen]
}

/**
 * The counter a list bumps to close everything under it. Pass `generation` to `CollapseAllContext`
 * around the list, and `collapse` to its button.
 */
export function useCollapseAll(): { generation: number; collapse: () => void } {
  const [generation, setGeneration] = useState(0)
  const collapse = useCallback(() => setGeneration((g) => g + 1), [])
  return { generation, collapse }
}

/**
 * A card with a files list inside: opening the files from the card's header opens the card too, so
 * the list is never toggled somewhere the user cannot see it.
 */
export function useFilesDisclosure(): {
  open: boolean
  setOpen: SetOpen
  filesOpen: boolean
  setFilesOpen: SetOpen
  toggleFiles: () => void
} {
  const [open, setOpen] = useCollapsible()
  const [listOpen, setFilesOpen] = useCollapsible()
  // The list only shows inside an open card; closing the card must not leave it "open" unseen.
  const filesOpen = open && listOpen
  const toggleFiles = () => {
    if (!open) {
      setOpen(true)
      setFilesOpen(true)
    } else setFilesOpen((v) => !v)
  }
  return { open, setOpen, filesOpen, setFilesOpen, toggleFiles }
}
