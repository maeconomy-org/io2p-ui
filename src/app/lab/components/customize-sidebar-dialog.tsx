'use client'

import { useState } from 'react'
import { GripVertical } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

export type Visibility = 'always' | 'unread' | 'never'

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: 'always', label: 'Always show' },
  { value: 'unread', label: 'Only when it has something' },
  { value: 'never', label: 'Never show' },
]

export interface SidebarItemPrefs {
  id: string
  label: string
  group: string
  visibility: Visibility
}

/**
 * Per-item visibility, not a global density toggle.
 *
 * "Only when it has something" is the option worth having: a workspace with no shares does not
 * need a Shares entry, and hiding it on emptiness beats asking every user to prune a list they
 * have not used yet. Order is drag-reorderable in the real thing; here the handles are decorative.
 */
export function CustomizeSidebarDialog({
  open,
  onOpenChange,
  items,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: SidebarItemPrefs[]
  onChange: (next: SidebarItemPrefs[]) => void
}) {
  const [draft, setDraft] = useState(items)

  const groups = [...new Set(draft.map((item) => item.group))]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(items)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customise sidebar</DialogTitle>
          <DialogDescription>
            Choose what appears, and in what order.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[24rem] space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group} className="space-y-1.5">
              <p className="text-sm font-medium">{group}</p>
              <div className="divide-y rounded-md border">
                {draft
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5"
                    >
                      <GripVertical
                        className="size-4 shrink-0 cursor-grab text-muted-foreground/50"
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-sm">
                        {item.label}
                      </span>
                      <Select
                        value={item.visibility}
                        onValueChange={(value) =>
                          setDraft((prev) =>
                            prev.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, visibility: value as Visibility }
                                : entry
                            )
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-[15rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIBILITY.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setDraft(items)}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              onChange(draft)
              onOpenChange(false)
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
