'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ObjectListItem } from 'io2p-client'

import type { FetchedPage } from '@/components/ui'
import { SEARCH_SIZE } from '@/constants'
import { useIomClient } from '@/lib/io2p'
import { logger } from '@/lib/observability/logger'
import { pickerSearch } from '@/lib/search-text'

export type SourceSearchRow = ObjectListItem & { uuid: string }

/** The duplicate sheet's source-object search, live while its picker is open. */
export function useSourceSearch(isOpen: boolean) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SourceSearchRow[]>([])
  // The search the rows on screen answer, for their marks.
  const [resultsSearch, setResultsSearch] = useState<string | undefined>()
  // Why the last search did not answer, shown where the rows would be.
  const [error, setError] = useState<unknown>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [page, setPage] = useState<FetchedPage>()
  // The `q` of the last search sent; `undefined` = the unfiltered list.
  const lastQRef = useRef<string | undefined | null>(undefined)
  // A new search aborts the one in flight, so a slow older answer cannot replace a newer one.
  const abortRef = useRef<AbortController | null>(null)

  // The search is imperative (debounced, fired from a callback), so it uses the client directly
  // rather than a query hook — the same shape `use-process-graph` uses for its sweep.
  const client = useIomClient()
  const clientRef = useRef(client)
  // See attachment-section: ref writes belong in an effect, and every reader
  // here is an event handler that runs after commit.
  useEffect(() => {
    clientRef.current = client
  }, [client])

  const reset = useCallback(() => {
    setQuery('')
    setResults([])
    setPage(undefined)
    setHasLoaded(false)
    lastQRef.current = undefined
    setError(null)
  }, [])

  const search = useCallback(
    async (q?: string) => {
      if (!isOpen) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearching(true)
      setError(null)
      try {
        const answer = await clientRef.current.objects.list(
          {
            q,
            size: SEARCH_SIZE,
            page: 1,
            scope: 'all',
            // Without this `childCount` is absent on every row, and the
            // "include children" switch gates on it — so recursive copy
            // silently disappeared for anything picked by search.
            withChildCounts: true,
          },
          { signal: controller.signal }
        )
        if (controller.signal.aborted) return

        // The list speaks `id`; this picker's markup speaks `uuid`.
        setResults(answer.data.map((o) => ({ ...o, uuid: o.id })))
        setPage(answer)
        setResultsSearch(q)
        setError(null)
        setHasLoaded(true)
      } catch (err) {
        if (controller.signal.aborted) return
        logger.error('Source search failed:', { err })
        setError(err)
        // Matches no search, so the next key press or reopen runs one, even back to the full list.
        lastQRef.current = null
        setResults([])
        setPage(undefined)
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [isOpen]
  )

  // Closing aborts a search still open, so its answer cannot land in a closed picker; the next open
  // asks again.
  useEffect(() => {
    if (!isOpen) return
    return () => {
      if (!abortRef.current) return
      abortRef.current.abort()
      abortRef.current = null
      setIsSearching(false)
      setHasLoaded(false)
      setResults([])
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const timeoutId = setTimeout(() => {
      const next = pickerSearch(query, lastQRef.current, hasLoaded)
      if (!next) return
      lastQRef.current = next.q
      void search(next.q)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, isOpen, hasLoaded, search])

  return {
    query,
    setQuery,
    results,
    resultsSearch,
    error,
    isSearching,
    page,
    reset,
  }
}

export type SourceSearch = ReturnType<typeof useSourceSearch>
