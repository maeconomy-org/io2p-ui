/**
 * Advanced Search Parser
 *
 * Parses search queries with special syntax into structured searchBy parameters.
 *
 * Supported syntax:
 * - `deleted:true` or `deleted:false` - Filter by soft deleted status
 * - `template:true` or `template:false` - Filter by template status
 * - `prop:label` - Search by property label only (any value)
 * - `prop:label=value` - Search by property label AND value
 * - `value:xyz` - Search by property value only (any property)
 * - `name:value` or `name:"multi word"` - Search by object name (quotes optional)
 * - `createdBy:uuid` - Filter by creator UUID
 * - `parent:uuid` - Filter by parent UUID
 * - Regular text becomes the searchTerm
 *
 * Examples:
 * - "deleted:true battery" → { searchBy: { softDeleted: true }, searchTerm: "battery" }
 * - "prop:material=steel" → { searchBy: { "properties.label": "material", "properties.values.value": "steel" } }
 * - "prop:material" → { searchBy: { "properties.label": "material" } } (any value)
 * - "value:steel" → { searchBy: { "properties.values.value": "steel" } } (any property)
 * - 'name:"Clay Tile"' → { searchBy: { "name": "Clay Tile" } }
 * - 'name:Clay Tile' → { searchBy: { "name": "Clay Tile" } } (quotes not required)
 */

export interface SearchFilter {
  type:
    | 'deleted'
    | 'template'
    | 'property'
    | 'propertyLabel'
    | 'propertyValue'
    | 'name'
    | 'createdBy'
    | 'parent'
    | 'text'
  label: string
  value: string
  raw: string // Original input token
  // For property filters, store the key and value separately
  propertyKey?: string
  propertyValue?: string
}

export interface ParsedSearch {
  searchTerm: string
  filters: SearchFilter[]
  searchBy: Record<string, unknown>
}

export interface FilterSuggestion {
  type: SearchFilter['type']
  prefix: string
  labelKey: string
  descriptionKey: string
  examples: string[]
  icon: string
}

// Available filter suggestions - uses translation keys for i18n
export const FILTER_SUGGESTIONS: FilterSuggestion[] = [
  {
    type: 'deleted',
    prefix: 'deleted:',
    labelKey: 'search.filters.deleted.label',
    descriptionKey: 'search.filters.deleted.description',
    examples: ['deleted:true', 'deleted:false'],
    icon: 'Trash2',
  },
  {
    type: 'property',
    prefix: 'prop:',
    labelKey: 'search.filters.property.label',
    descriptionKey: 'search.filters.property.description',
    examples: ['prop:material=steel', 'prop:status'],
    icon: 'Tag',
  },
  {
    type: 'propertyValue',
    prefix: 'value:',
    labelKey: 'search.filters.value.label',
    descriptionKey: 'search.filters.value.description',
    examples: ['value:steel', 'value:active'],
    icon: 'Hash',
  },
  {
    type: 'name',
    prefix: 'name:',
    labelKey: 'search.filters.name.label',
    descriptionKey: 'search.filters.name.description',
    examples: ['name:Battery', 'name:Clay Tile'],
    icon: 'Type',
  },
  {
    type: 'createdBy',
    prefix: 'createdBy:',
    labelKey: 'search.filters.createdBy.label',
    descriptionKey: 'search.filters.createdBy.description',
    examples: ['createdBy:abc-123-def'],
    icon: 'User',
  },
  {
    type: 'parent',
    prefix: 'parent:',
    labelKey: 'search.filters.parent.label',
    descriptionKey: 'search.filters.parent.description',
    examples: ['parent:abc-123-def'],
    icon: 'FolderTree',
  },
]

// Helper to check if a token is a filter prefix
function isFilterPrefix(token: string): boolean {
  const lower = token.toLowerCase()
  return (
    lower.startsWith('deleted:') ||
    lower.startsWith('template:') ||
    lower.startsWith('prop:') ||
    lower.startsWith('value:') ||
    lower.startsWith('name:') ||
    lower.startsWith('createdby:') ||
    lower.startsWith('parent:')
  )
}

/**
 * Parse a search query into structured parts
 */
export function parseSearchQuery(query: string): ParsedSearch {
  const filters: SearchFilter[] = []
  const searchBy: Record<string, unknown> = {}
  const textParts: string[] = []

  // Split by spaces, but respect quoted strings
  const tokens = tokenizeQuery(query)

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    const lowerToken = token.toLowerCase()

    // Check for deleted: filter (only true/false)
    if (lowerToken.startsWith('deleted:')) {
      const value = token.slice(8).toLowerCase()
      if (value === 'true' || value === 'false') {
        const boolValue = value === 'true'
        filters.push({
          type: 'deleted',
          label: `Deleted: ${value}`,
          value: boolValue.toString(),
          raw: token,
        })
        searchBy.softDeleted = boolValue
      }
      i++
      continue
    }

    // Check for template: filter (only true/false)
    if (lowerToken.startsWith('template:')) {
      const value = token.slice(9).toLowerCase()
      if (value === 'true' || value === 'false') {
        const boolValue = value === 'true'
        filters.push({
          type: 'template',
          label: `Template: ${value}`,
          value: boolValue.toString(),
          raw: token,
        })
        searchBy.isTemplate = boolValue
      }
      i++
      continue
    }

    // Check for prop: filter (format: prop:label or prop:label=value)
    if (lowerToken.startsWith('prop:')) {
      const propPart = token.slice(5)
      const eqIndex = propPart.indexOf('=')

      if (eqIndex > 0) {
        // Has both label and value: prop:label=value
        const label = propPart.slice(0, eqIndex)
        const value = propPart.slice(eqIndex + 1)
        filters.push({
          type: 'property',
          label: `${label}: ${value}`,
          value: `${label}=${value}`,
          raw: token,
          propertyKey: label,
          propertyValue: value,
        })
        // Set both in searchBy
        searchBy['properties.label'] = label
        searchBy['properties.values.value'] = value
      } else if (propPart.trim()) {
        // Only label: prop:label (search any object with this property)
        const label = propPart.trim()
        filters.push({
          type: 'propertyLabel',
          label: `Property: ${label}`,
          value: label,
          raw: token,
          propertyKey: label,
        })
        // Only set the label
        searchBy['properties.label'] = label
      }
      i++
      continue
    }

    // Check for value: filter (search by property value only)
    if (lowerToken.startsWith('value:')) {
      const value = token.slice(6).trim()
      if (value) {
        filters.push({
          type: 'propertyValue',
          label: `Value: ${value}`,
          value: value,
          raw: token,
          propertyValue: value,
        })
        searchBy['properties.values.value'] = value
      }
      i++
      continue
    }

    // Check for name: filter - collect all subsequent non-filter tokens
    if (lowerToken.startsWith('name:')) {
      const nameParts: string[] = []
      let nameRaw = token

      // Get the first part after name:
      const firstPart = token.slice(5).replace(/^"|"$/g, '')
      if (firstPart) {
        nameParts.push(firstPart)
      }

      // If the first part is quoted, we're done
      if (!token.slice(5).startsWith('"')) {
        // Not quoted, collect subsequent tokens until we hit another filter
        i++
        while (i < tokens.length && !isFilterPrefix(tokens[i])) {
          nameParts.push(tokens[i].replace(/^"|"$/g, ''))
          nameRaw += ' ' + tokens[i]
          i++
        }
        i-- // Back up one since the loop will increment
      }

      const nameValue = nameParts.join(' ').trim()
      if (nameValue) {
        filters.push({
          type: 'name',
          label: `Name: ${nameValue}`,
          value: nameValue,
          raw: nameRaw,
        })
        searchBy.name = nameValue
      }
      i++
      continue
    }

    // Check for createdBy: filter
    if (lowerToken.startsWith('createdby:')) {
      const value = token.slice(10)
      filters.push({
        type: 'createdBy',
        label: `Created by: ${value.slice(0, 8)}...`,
        value,
        raw: token,
      })
      searchBy.createdByUserUUID = value
      i++
      continue
    }

    // Check for parent: filter
    if (lowerToken.startsWith('parent:')) {
      const value = token.slice(7)
      filters.push({
        type: 'parent',
        label: `Parent: ${value.slice(0, 8)}...`,
        value,
        raw: token,
      })
      searchBy.parentUUID = value
      i++
      continue
    }

    // Regular text
    if (token.trim()) {
      textParts.push(token.replace(/^"|"$/g, ''))
      filters.push({
        type: 'text',
        label: token,
        value: token,
        raw: token,
      })
    }
    i++
  }

  return {
    searchTerm: textParts.join(' '),
    filters,
    searchBy,
  }
}

/**
 * Tokenize a query string, respecting quoted strings
 */
function tokenizeQuery(query: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < query.length; i++) {
    const char = query[i]

    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    tokens.push(current.trim())
  }

  return tokens
}

/**
 * Get matching filter suggestions based on current input
 */
export function getFilterSuggestions(input: string): FilterSuggestion[] {
  if (!input) return FILTER_SUGGESTIONS

  const lowerInput = input.toLowerCase()

  // Check if user is typing a filter prefix
  // Note: labelKey matching is handled in the UI component with translations
  return FILTER_SUGGESTIONS.filter((suggestion) =>
    suggestion.prefix.startsWith(lowerInput)
  )
}

/**
 * Build a display string from filters
 */
export function filtersToDisplayString(filters: SearchFilter[]): string {
  return filters.map((f) => f.raw).join(' ')
}

/**
 * Remove a filter and rebuild the query
 */
export function removeFilter(
  filters: SearchFilter[],
  filterToRemove: SearchFilter
): string {
  return filters
    .filter((f) => f !== filterToRemove)
    .map((f) => f.raw)
    .join(' ')
}
