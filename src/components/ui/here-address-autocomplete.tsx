'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { MapPin, Loader2 } from 'lucide-react'

import { logger } from '@/lib/observability/logger'
import { authFetch } from '@/lib/auth/fetch'
import { Input } from '@/components/ui'
import { ALPHA3_TO_ALPHA2 } from '@/constants/country-codes'

export interface AddressComponents {
  street: string
  houseNumber: string
  city: string
  postalCode: string
  country: string
  state?: string
  district?: string
  fullAddress: string
  /**
   * Rooftop/parcel centre of the picked suggestion. Absent when the lookup failed or HERE has no
   * position — never blocks the address itself.
   *
   * This is `position`, NOT HERE's `access` (the routable point on the street). Same building,
   * different coordinates: correct for map pins and radius queries, wrong as input to drive-time
   * isolines. Worth knowing before anyone assumes the stored point routes.
   */
  lat?: number
  lng?: number
}

/**
 * The country as a STABLE code, not as prose.
 *
 * HERE gives both `countryCode` ("NLD", ISO alpha-3) and `countryName` ("Nederland" — localised, so
 * its text depends on the request language). Storing the name made "all assets in NL" a string match
 * against a value that could be Nederland, Netherlands or Pays-Bas depending on when the row was
 * written. io2p's schema documents alpha-2, so the alpha-3 is converted here.
 *
 * Falls back to the name only when the code is missing or unmapped — an address with SOMETHING in
 * its country field beats one with nothing, and `countryLabel` renders a non-code unchanged.
 */
function countryCode(address: { countryCode?: string; countryName?: string }) {
  const alpha3 = address.countryCode?.toUpperCase()
  const alpha2 = alpha3 ? ALPHA3_TO_ALPHA2[alpha3] : undefined
  if (alpha3 && !alpha2) {
    logger.warn('Unmapped HERE country code', { countryCode: alpha3 })
  }
  return alpha2 ?? address.countryName ?? ''
}

/**
 * Resolve a picked suggestion to coordinates.
 *
 * A failed lookup applies the address WITHOUT coordinates — the one place a fallback belongs here.
 * Blocking address entry on a geocoding outage is worse than a missing coordinate a backfill can
 * repair later. It is logged rather than swallowed: "addresses stopped getting coordinates" is
 * otherwise invisible for months.
 */
async function lookupPosition(
  id: string
): Promise<{ lat: number; lng: number } | null> {
  if (!id) return null
  try {
    const response = await authFetch(
      `/api/address?id=${encodeURIComponent(id)}`
    )
    const data = await response.json()
    const { lat, lng } = data?.position ?? {}
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      logger.warn('HERE lookup returned no position', { id })
      return null
    }
    return { lat, lng }
  } catch (error) {
    logger.warn('HERE lookup failed; address applied without coordinates', {
      id,
      error,
    })
    return null
  }
}

interface HereAddressAutocompleteProps {
  value?: string
  placeholder?: string
  onAddressSelect: (fullAddress: string, components: AddressComponents) => void
  disabled?: boolean
  className?: string
}

export function HereAddressAutocomplete({
  value = '',
  placeholder = 'Start typing an address...',
  onAddressSelect,
  disabled = false,
  className = '',
}: HereAddressAutocompleteProps) {
  const t = useTranslations()
  const [query, setQuery] = useState('')
  /**
   * What the user TYPED, which is the only thing worth searching for.
   *
   * `query` also changes when a suggestion is picked and when the `value` prop syncs in, and driving
   * the debounced search off it meant HERE was queried for an address that had just been RESOLVED —
   * one wasted request per selection, and another every time a sheet opened on an object that
   * already had one. It also left stale suggestions behind the closed dropdown for the next focus
   * to reopen.
   */
  const [typedQuery, setTypedQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Which coordinate lookup is current, so a slow earlier one cannot answer after a newer pick.
  const lookupSeq = useRef(0)
  // React's documented "adjust state when a prop changes" pattern: hold the
  // previous prop in STATE, not a ref, and compare during render. A ref written
  // during render is unsound (the render may be discarded), which is what
  // react-hooks/refs flags; state set during render is the sanctioned form and
  // React re-runs the component immediately without committing the first pass.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (query !== value) {
      setQuery(value)
    }
  }

  const searchAddresses = (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    try {
      // Use our API route to hide HERE API key
      authFetch(`/api/address?q=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data.items || [])
        })
        .catch((error) => {
          logger.error('Error searching addresses:', { err: error })
          setSuggestions([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    } catch (error) {
      logger.error('Error searching addresses:', { err: error })
      setSuggestions([])
      setIsLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (typedQuery) {
        searchAddresses(typedQuery)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [typedQuery])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    // The ONE place a search is armed. Everything else that moves `query` — picking a suggestion,
    // the `value` prop syncing in — deliberately leaves this alone.
    setTypedQuery(newValue)
    setIsOpen(true)
    setSelectedIndex(-1)
  }

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: any) => {
    const fullAddress = suggestion.address.label
    const components: AddressComponents = {
      street: suggestion.address.street || '',
      houseNumber: suggestion.address.houseNumber || '',
      city: suggestion.address.city || '',
      postalCode: suggestion.address.postalCode || '',
      country: countryCode(suggestion.address),
      state: suggestion.address.state || '',
      district: suggestion.address.district || '',
      fullAddress: fullAddress,
    }

    setQuery(fullAddress)
    setIsOpen(false)
    setSuggestions([])
    setSelectedIndex(-1)

    // Reported IMMEDIATELY, then again once coordinates land. Awaiting the lookup before the first
    // call would leave a window where the input shows the address but the form does not hold it —
    // saving in that window would lose the address entirely, which is far worse than losing a
    // coordinate.
    onAddressSelect(fullAddress, components)

    const seq = ++lookupSeq.current
    setIsLoading(true)
    const position = await lookupPosition(suggestion.id)
    // A newer pick superseded this one; letting a slow earlier lookup answer last would overwrite
    // the address the user actually chose.
    if (seq !== lookupSeq.current) return

    setIsLoading(false)
    if (position) onAddressSelect(fullAddress, { ...components, ...position })
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          void handleSuggestionSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          data-testid="address-input"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          data-testid="address-suggestions"
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              data-testid={`address-suggestion-${index}`}
              className={`px-4 py-3 cursor-pointer hover:bg-muted/50 border-b border-border last:border-b-0 ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
              onClick={() => void handleSuggestionSelect(suggestion)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {suggestion.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {suggestion.address.city}, {suggestion.address.countryName}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen &&
        !isLoading &&
        query.length >= 2 &&
        suggestions.length === 0 && (
          <div
            ref={dropdownRef}
            data-testid="address-no-results"
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4"
          >
            <div className="text-sm text-muted-foreground text-center">
              {t('objects.address.noResults', { query })}
            </div>
          </div>
        )}
    </div>
  )
}
