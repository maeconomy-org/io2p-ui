'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Link2,
  Package,
  Shield,
  UserPlus,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Button, Input } from '@/components/ui'

import { SeededAvatar } from '../components/seeded-avatar'

type Permission = 'read' | 'write' | 'share' | 'admin'

/**
 * A REASON, not a row.
 *
 * The grant model is keyed by `(resource, subject, source)` and effective access is the union,
 * most-permissive-wins. Every input for "why" is already in the API — the UI just never asks the
 * question. That silence is not neutral: someone who cannot see why a person has access either
 * over-shares to be safe, or stops sharing entirely.
 */
interface Reason {
  kind: 'direct' | 'bundle' | 'inherited' | 'public'
  permission: Permission
  /** What to say, in one line, without the reader knowing the model. */
  because: string
  /** The thing to click to change it — every reason must be actionable or it is trivia. */
  action: string
  cascade?: boolean
}

interface Person {
  id: string
  name: string
  secondary: string
  reasons: Reason[]
}

const RANK: Record<Permission, number> = {
  read: 0,
  write: 1,
  share: 2,
  admin: 3,
}

const PEOPLE: Person[] = [
  {
    id: 'u1',
    name: 'Anna Roos',
    secondary: 'anna@northgate.example',
    reasons: [
      {
        kind: 'direct',
        permission: 'read',
        because: 'You gave Anna read on this object on 12 June',
        action: 'Change or revoke',
      },
      {
        kind: 'bundle',
        permission: 'write',
        because: 'The share "Q3 contractors" includes this object',
        action: 'Manage the share',
      },
    ],
  },
  {
    id: 'u2',
    name: 'Ben Aker',
    secondary: 'Signed in with a certificate',
    reasons: [
      {
        kind: 'inherited',
        permission: 'read',
        because: 'Ben has read on Northgate House, and that grant cascades',
        action: 'Open Northgate House',
        cascade: true,
      },
    ],
  },
  {
    id: 'u3',
    name: 'Clara Fenn',
    secondary: 'clara@auditors.example',
    reasons: [
      {
        kind: 'bundle',
        permission: 'read',
        because: 'The share "Auditors 2026" includes this object',
        action: 'Manage the share',
      },
      {
        kind: 'bundle',
        permission: 'read',
        because: 'The share "Portfolio read-only" includes it too',
        action: 'Manage the share',
      },
    ],
  },
]

const KIND_ICON = {
  direct: UserPlus,
  bundle: Package,
  inherited: Link2,
  public: Boxes,
}

const KIND_LABEL = {
  direct: 'Given directly',
  bundle: 'Through a share',
  inherited: 'Inherited from a parent',
  public: 'Public on this node',
}

function effective(reasons: Reason[]): Permission {
  return reasons.reduce<Permission>(
    (best, r) => (RANK[r.permission] > RANK[best] ? r.permission : best),
    'read'
  )
}

function PersonRow({ person }: { person: Person }) {
  const [open, setOpen] = useState(false)
  const level = effective(person.reasons)
  const many = person.reasons.length > 1

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <SeededAvatar seed={person.id} className="size-8" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {person.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {person.secondary}
          </span>
        </span>

        <Badge variant={level} className="shrink-0 capitalize">
          {level}
        </Badge>

        {/* The count IS the invitation to expand. "2 reasons" is the only hint that an
            effective permission is a union rather than something you set once. */}
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {many ? `${person.reasons.length} reasons` : '1 reason'}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-2 bg-muted/30 px-4 pb-3 pt-1">
          {many && (
            <p className="text-xs text-muted-foreground">
              {person.name} can <strong>{level}</strong> because the most
              permissive of these wins — removing one is not enough.
            </p>
          )}
          {person.reasons.map((reason, index) => {
            const Icon = KIND_ICON[reason.kind]
            return (
              <div
                key={index}
                className="flex items-start gap-3 rounded-md border bg-background p-3"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {KIND_LABEL[reason.kind]}
                    <Badge variant={reason.permission} className="capitalize">
                      {reason.permission}
                    </Badge>
                    {reason.cascade && (
                      <Badge variant="outline" className="font-normal">
                        cascades
                      </Badge>
                    )}
                  </p>
                  <p className="pt-1 text-sm">{reason.because}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1 text-xs"
                >
                  {reason.action}
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AccessLabPage() {
  const [query, setQuery] = useState('')
  const people = PEOPLE.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-medium">
          <Shield className="size-4 text-muted-foreground" />
          Who can reach Room 101
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone who can see this object, and exactly why.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a person…"
          aria-label="Find a person"
        />
        <Button type="button" className="gap-1.5">
          <UserPlus className="size-4" />
          Add someone
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
        {people.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nobody by that name has access.
          </p>
        )}
      </div>

      {/* The inverse question, and the one people actually get wrong. Revoking a direct grant
          from someone who is also in a share changes nothing, and today the UI lets you do it
          and shows success. */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
        <X className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm">
          Removing one reason does not always remove access. Anna keeps{' '}
          <strong>write</strong> through &quot;Q3 contractors&quot; even if you
          revoke what you gave her directly.
        </p>
      </div>
    </div>
  )
}
