'use client'

import { Globe, Lock, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface GroupBadgeProps {
  groupName: string
  groupType: 'public' | 'private'
  size?: 'sm' | 'md'
  className?: string
}

export function GroupBadge({
  groupName,
  groupType,
  size = 'sm',
  className,
}: GroupBadgeProps) {
  const getTypeIcon = () => {
    return groupType === 'public' ? (
      <Globe className="h-3 w-3" />
    ) : (
      <Lock className="h-3 w-3" />
    )
  }

  const getTypeColor = () => {
    return groupType === 'public'
      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 font-normal',
        getTypeColor(),
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
    >
      {getTypeIcon()}
      <span className="truncate max-w-[100px]" title={groupName}>
        {groupName}
      </span>
    </Badge>
  )
}

// Component for displaying multiple group badges
interface GroupBadgesProps {
  groups: Array<{
    name: string
    type: 'public' | 'private'
  }>
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

export function GroupBadges({
  groups,
  maxVisible = 2,
  size = 'sm',
  className,
}: GroupBadgesProps) {
  if (!groups || groups.length === 0) {
    return null
  }

  const visibleGroups = groups.slice(0, maxVisible)
  const remainingCount = groups.length - maxVisible

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {visibleGroups.map((group, index) => (
        <GroupBadge
          key={index}
          groupName={group.name}
          groupType={group.type}
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className={cn(
            'flex items-center gap-1 bg-gray-50 text-gray-600 border-gray-200',
            size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
          )}
        >
          <Users className="h-3 w-3" />+{remainingCount}
        </Badge>
      )}
    </div>
  )
}
