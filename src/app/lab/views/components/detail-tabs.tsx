'use client'

import {
  ArrowRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Package,
  Plus,
  UserPlus,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Button } from '@/components/ui'

import { SeededAvatar } from '../../components/seeded-avatar'

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

const CHILDREN = [
  { name: 'Desk cluster A', type: 'Asset', area: '6 m²' },
  { name: 'Storage unit 4', type: 'Asset', area: '2 m²' },
  { name: 'Partition wall', type: 'Element', area: '—' },
]

export function ChildrenTab() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <p className="text-sm text-muted-foreground">
          {CHILDREN.length} direct children
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
        >
          <Plus className="size-3" />
          Add child
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {CHILDREN.map((child) => (
          <button
            key={child.name}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <SeededAvatar seed={child.name} square className="size-5" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {child.name}
            </span>
            <Badge variant="outline" className="font-normal">
              {child.type}
            </Badge>
            <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
              {child.area}
            </span>
          </button>
        ))}
      </div>
      {/* The DAG detail people miss: a child can hang off more than one parent, so removing it
          here does not delete it. Saying so at the point of the action prevents the wrong model. */}
      <p className="pt-2 text-xs text-muted-foreground">
        Children can have several parents. Removing one here unlinks it, it does
        not delete it.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const FILES = [
  {
    name: 'room-101-plan.pdf',
    size: '1.2 MB',
    kind: 'upload' as const,
    attached: 'On the object',
  },
  {
    name: 'Cadastre record',
    size: '—',
    kind: 'reference' as const,
    attached: 'On property `area`',
  },
]

export function FilesTab() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <p className="text-sm text-muted-foreground">{FILES.length} files</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
        >
          <Plus className="size-3" />
          Attach
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {FILES.map((file) => (
          <div key={file.name} className="flex items-center gap-2 px-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted">
              {file.kind === 'upload' ? (
                <FileText className="size-3.5 text-muted-foreground" />
              ) : (
                <Link2 className="size-3.5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{file.name}</span>
              {/* WHERE a file is attached is part of what it is — io2p attaches at entity,
                  property or value level, and a flat list would lose that entirely. */}
              <span className="block truncate text-xs text-muted-foreground">
                {file.attached} · {file.size}
              </span>
            </span>
            <Badge variant="outline" className="shrink-0 font-normal">
              {file.kind}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={
                file.kind === 'upload'
                  ? `Download ${file.name}`
                  : `Open ${file.name}`
              }
            >
              {file.kind === 'upload' ? (
                <Download className="size-3.5" />
              ) : (
                <ExternalLink className="size-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

const ACCESS = [
  {
    id: 'u1',
    name: 'Anna Roos',
    level: 'write' as const,
    reasons: ['Given directly · read', 'Share "Q3 contractors" · write'],
  },
  {
    id: 'u2',
    name: 'Ben Aker',
    level: 'read' as const,
    reasons: ['Inherited from Northgate House · read'],
  },
]

export function AccessTab() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 pb-2">
        <p className="text-sm text-muted-foreground">
          {ACCESS.length} people can reach this
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
        >
          <UserPlus className="size-3" />
          Share
        </Button>
      </div>

      <div className="divide-y rounded-lg border">
        {ACCESS.map((person) => (
          <div key={person.id} className="space-y-1.5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <SeededAvatar seed={person.id} className="size-6" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {person.name}
              </span>
              <Badge variant={person.level} className="capitalize">
                {person.level}
              </Badge>
            </div>
            {/* Every reason listed, always. The effective level is a UNION, so showing only the
                winner makes "revoke" look like it will work when it will not. */}
            <ul className="space-y-0.5 pl-8">
              {person.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  {reason.startsWith('Share') ? (
                    <Package className="size-3 shrink-0" />
                  ) : reason.startsWith('Inherited') ? (
                    <Link2 className="size-3 shrink-0" />
                  ) : (
                    <UserPlus className="size-3 shrink-0" />
                  )}
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 w-full gap-1 text-xs text-muted-foreground"
      >
        See the full access map
        <ArrowRight className="size-3" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

const ACTIVITY = [
  {
    at: '2 Aug, 14:12',
    who: 'Anna Roos',
    what: 'changed `area` from 22 m² to 24 m²',
    version: 3,
  },
  {
    at: '28 Jul, 09:40',
    who: 'You',
    what: 'attached room-101-plan.pdf',
    version: 2,
  },
  {
    at: '24 Jun, 11:02',
    who: 'Anna Roos',
    what: 'created this object from the Room template',
    version: 1,
  },
]

export function ActivityTab() {
  return (
    <div className="p-3">
      <ol className="space-y-0">
        {ACTIVITY.map((entry, index) => (
          <li key={entry.at} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border" />
              {index < ACTIVITY.length - 1 && (
                <span className="w-px flex-1 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <p className="text-sm">
                <span className="font-medium">{entry.who}</span> {entry.what}
              </p>
              <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {entry.at}
                <span className="tabular-nums">· v{entry.version}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Honest about the gap: the store is hash-chained and insert-only, but there is no events
          endpoint yet, so this is a projection of what the UI happens to know. */}
      <p
        className={cn(
          'rounded-md bg-muted/50 p-2 text-xs text-muted-foreground'
        )}
      >
        Version history exists in the event log. A read endpoint would let this
        show every change, and diff any two versions.
      </p>
    </div>
  )
}
