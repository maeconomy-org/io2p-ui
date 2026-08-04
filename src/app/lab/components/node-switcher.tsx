'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Server } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'

/**
 * The org switcher shape, aimed at MULTI-NODE rather than multi-tenant.
 *
 * io2p is a federation of nodes, so the thing a user switches between is a node they hold
 * credentials on — not an org row inside one database. That changes two things from the shadcn
 * pattern it borrows: the subtitle is the node's HOST (identity is per-node), and "add" means
 * connecting to a node, not creating a workspace.
 */
export interface LabNode {
  id: string
  name: string
  host: string
  role: string
}

const NODES: LabNode[] = [
  {
    id: 'n1',
    name: 'Northgate',
    host: 'node.northgate.example',
    role: 'Owner',
  },
  {
    id: 'n2',
    name: 'Musterstadt',
    host: 'io2p.musterstadt.de',
    role: 'Member',
  },
  { id: 'n3', name: 'Local dev', host: 'localhost:3001', role: 'Owner' },
]

export function NodeSwitcher({ collapsed }: { collapsed: boolean }) {
  const [activeId, setActiveId] = useState('n1')
  const active = NODES.find((n) => n.id === activeId) ?? NODES[0]!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label="Switch node"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Server className="size-3.5" />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">
                  {active.name}
                </span>
                <span className="block truncate text-xs leading-tight text-muted-foreground">
                  {active.host}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Nodes
        </DropdownMenuLabel>
        {NODES.map((node, index) => (
          <DropdownMenuItem
            key={node.id}
            onClick={() => setActiveId(node.id)}
            className="gap-2"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded border">
              <Server className="size-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{node.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {node.role}
              </span>
            </span>
            {node.id === activeId ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <kbd className="shrink-0 text-xs text-muted-foreground">
                ⌘{index + 1}
              </kbd>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded border border-dashed">
            <Plus className="size-3" />
          </span>
          Connect a node
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
