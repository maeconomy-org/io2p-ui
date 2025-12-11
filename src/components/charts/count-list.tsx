'use client'

interface CountListProps {
  data: Record<string, number>
  title?: string
  emptyMessage?: string
  maxItems?: number
}

export function CountList({
  data,
  title,
  emptyMessage = 'No data available',
  maxItems
}: CountListProps) {
  let sortedEntries = Object.entries(data).sort(([,a], [,b]) => b - a)
  
  // Limit to top N items if maxItems is specified
  if (maxItems && sortedEntries.length > maxItems) {
    const topEntries = sortedEntries.slice(0, maxItems)
    const othersSum = sortedEntries.slice(maxItems).reduce((sum, [, value]) => sum + value, 0)
    
    if (othersSum > 0) {
      topEntries.push(['others', othersSum])
    }
    
    sortedEntries = topEntries
  }

  const hasData = sortedEntries.length > 0

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedEntries.map(([name, value]) => {
        const displayName = name.toLowerCase().replace(/_/g, ' ')
        const formattedName = displayName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
        
        return (
          <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              {formattedName}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((value / Math.max(...sortedEntries.map(([,v]) => v))) * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 min-w-[2rem] text-right">
                {value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
