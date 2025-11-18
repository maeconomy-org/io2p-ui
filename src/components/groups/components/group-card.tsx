'use client'

import {
  MoreHorizontal,
  Users,
  Package,
  Lock,
  Globe,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CopyButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'

interface Group {
  uuid: string
  name: string
  description?: string
  type: 'public' | 'private'
  permissions: {
    level: 'read' | 'write' // write includes read access
  }
  objectCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  isDeleted?: boolean
}

interface GroupCardProps {
  group: Group
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

export function GroupCard({ group, onView, onEdit, onDelete }: GroupCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getTypeIcon = () => {
    if (group.type === 'public') {
      return <Globe className="h-4 w-4" />
    }
    return <Lock className="h-4 w-4" />
  }

  const getTypeColor = () => {
    if (group.type === 'public') {
      return 'bg-green-100 text-green-800 border-green-200'
    }
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  const getPermissionBadge = () => {
    if (group.permissions.level === 'write') {
      return (
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-700 border-orange-200"
        >
          Write Access
        </Badge>
      )
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-gray-100 text-gray-600 border-gray-200"
        >
          Read Only
        </Badge>
      )
    }
  }

  const isDeleted = group.isDeleted === true

  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${
        isDeleted ? 'bg-red-50 border-red-200 opacity-75' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getTypeColor()}>
              {getTypeIcon()}
              <span className="ml-1 capitalize">{group.type}</span>
            </Badge>
            {getPermissionBadge()}
            {isDeleted && (
              <Badge
                variant="destructive"
                className="bg-red-100 text-red-700 border-red-200"
              >
                🗑️ Deleted
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>View Details</DropdownMenuItem>
              {group.permissions.level === 'write' && !isDeleted && (
                <DropdownMenuItem onClick={onEdit}>Edit Group</DropdownMenuItem>
              )}
              {group.permissions.level === 'write' && !isDeleted && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Group
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div onClick={onView} className="cursor-pointer">
          <h3
            className={`font-semibold text-lg leading-tight ${
              isDeleted ? 'line-through text-red-600' : ''
            }`}
          >
            {group.name}
          </h3>
          {group.description && (
            <p
              className={`text-sm mt-1 line-clamp-2 ${
                isDeleted
                  ? 'text-red-500 line-through'
                  : 'text-muted-foreground'
              }`}
              title={
                group.description.length > 120 ? group.description : undefined
              }
            >
              {group.description.length > 120
                ? `${group.description.substring(0, 120)}...`
                : group.description}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0" onClick={onView}>
        {/* <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>{group.objectCount} objects</span>
          </div>
        </div> */}

        {/* UUID with copy button */}
        <div className="flex items-center gap-2">
          <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {group.uuid}
          </code>
          <CopyButton
            text={group.uuid}
            label="Group UUID"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0"
            showToast={true}
          />
        </div>
      </CardContent>
    </Card>
  )
}
