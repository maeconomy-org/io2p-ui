'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

import { logger } from '@/lib'
import { Input } from '@/components/ui'

export interface AddressComponents {
  street: string
  houseNumber: string
  city: string
  postalCode: string
  country: string
  state?: string
  district?: string
  fullAddress: string
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
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update query when value prop changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  const searchAddresses = (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    try {
      // Use our API route to hide HERE API key
      fetch(`/api/address?q=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data.items || [])
        })
        .catch((error) => {
          logger.error('Error searching addresses:', error)
          setSuggestions([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    } catch (error) {
      logger.error('Error searching addresses:', error)
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
      if (query) {
        searchAddresses(query)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    setIsOpen(true)
    setSelectedIndex(-1)
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: any) => {
    const fullAddress = suggestion.address.label
    const components: AddressComponents = {
      street: suggestion.address.street || '',
      houseNumber: suggestion.address.houseNumber || '',
      city: suggestion.address.city || '',
      postalCode: suggestion.address.postalCode || '',
      country: suggestion.address.countryName || '',
      state: suggestion.address.state || '',
      district: suggestion.address.district || '',
      fullAddress: fullAddress,
    }

    setQuery(fullAddress)
    setIsOpen(false)
    setSuggestions([])
    setSelectedIndex(-1)

    onAddressSelect(fullAddress, components)
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
          handleSuggestionSelect(suggestions[selectedIndex])
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
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-4 py-3 cursor-pointer hover:bg-muted/50 border-b border-border last:border-b-0 ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
              onClick={() => handleSuggestionSelect(suggestion)}
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
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4"
          >
            <div className="text-sm text-muted-foreground text-center">
              No addresses found for "{query}"
            </div>
          </div>
        )}
    </div>
  )
}
