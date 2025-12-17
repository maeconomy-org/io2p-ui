'use client'

import { useState } from 'react'
import {
  Package,
  Globe,
  Lock,
  Calendar,
  Edit,
  Plus,
  Minus,
  User,
  X,
} from 'lucide-react'
import {
  Button,
  Badge,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  CopyButton,
  ScrollArea,
} from '@/components/ui'
import { dummyObjects } from '../data'

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
  objects: string[]
  isDeleted?: boolean
}

interface GroupViewSheetProps {
  group: Group | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}

export function GroupViewSheet({
  group,
  open,
  onOpenChange,
  onEdit,
}: GroupViewSheetProps) {
  const [activeTab, setActiveTab] = useState('objects')
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)

  if (!group) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = () => {
    return group.type === 'public' ? (
      <Globe className="h-4 w-4" />
    ) : (
      <Lock className="h-4 w-4" />
    )
  }

  const getTypeColor = () => {
    return group.type === 'public'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  const getPermissionBadge = () => {
    if (group.permissions.level === 'write') {
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
          Write Access
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200">
          Read Only
        </Badge>
      )
    }
  }

  // Filter dummy objects that belong to this group
  const groupObjects = dummyObjects.filter((obj) =>
    group.objects.includes(obj.uuid)
  )
  const isDeleted = group.isDeleted === true

  const handleRemoveObject = (objectUuid: string) => {
    if (confirmingRemove === objectUuid) {
      // Second click - confirm removal
      setConfirmingRemove(null)
      // In real implementation, this would call the API
    } else {
      // First click - show confirm state
      setConfirmingRemove(objectUuid)
      // Reset confirm state after 3 seconds
      setTimeout(() => setConfirmingRemove(null), 3000)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="space-y-4 mb-4">
          <div className="space-y-3">
            <SheetTitle
              className={`text-2xl ${isDeleted ? 'line-through text-red-600' : ''}`}
            >
              {group.name}
            </SheetTitle>
            {group.description && (
              <p
                className={`${isDeleted ? 'text-red-500 line-through' : 'text-muted-foreground'}`}
              >
                {group.description}
              </p>
            )}

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
                  Deleted
                </Badge>
              )}
            </div>

            {/* Group UUID with copy */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Group UUID:</span>
              <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs text-muted-foreground">
                {group.uuid}
              </code>
              <CopyButton
                text={group.uuid}
                label="Group UUID"
                size="sm"
                variant="ghost"
                showToast={true}
                className="h-4 w-4 p-0"
              />
            </div>

            {/* Owner info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Created by:</span>
              <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">
                {group.createdBy}
              </code>
              <CopyButton
                text={group.createdBy}
                label="Creator UUID"
                size="sm"
                variant="ghost"
                showToast={true}
                className="h-4 w-4 p-0"
              />
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="objects">Objects</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="objects" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Group Objects ({groupObjects.length})
              </h3>
              {group.permissions.level === 'write' && !isDeleted && (
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Objects
                </Button>
              )}
            </div>

            <ScrollArea className="h-[400px] w-full">
              <div className="space-y-2 pr-4">
                {groupObjects.length > 0 ? (
                  groupObjects.map((obj) => (
                    <div
                      key={obj.uuid}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="font-medium">{obj.name}</div>
                      </div>
                      {group.permissions.level === 'write' && !isDeleted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-xs ${
                            confirmingRemove === obj.uuid
                              ? 'text-destructive bg-destructive/10'
                              : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                          }`}
                          onClick={() => handleRemoveObject(obj.uuid)}
                        >
                          {confirmingRemove === obj.uuid ? (
                            'Confirm?'
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No objects in this group yet.</p>
                    {group.permissions.level === 'write' && !isDeleted && (
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Object
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-3">Group Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Group Type</div>
                      <div className="text-sm text-muted-foreground">
                        {group.type === 'public'
                          ? 'Anyone can view this group'
                          : 'Only specific users can access'}
                      </div>
                    </div>
                    <Badge className={getTypeColor()}>
                      {getTypeIcon()}
                      <span className="ml-1 capitalize">{group.type}</span>
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Your Permissions</div>
                      <div className="text-sm text-muted-foreground">
                        {group.permissions.level === 'write'
                          ? 'You can read and edit objects in this group'
                          : 'You can only view objects in this group'}
                      </div>
                    </div>
                    {getPermissionBadge()}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Group UUID</div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {group.uuid}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Created</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(group.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Last Updated</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(group.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Button at Bottom */}
        {group.permissions.level === 'write' && !isDeleted && onEdit && (
          <div className="pt-4 flex items-center gap-2">
            <Button onClick={onEdit} className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              Edit Group
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
