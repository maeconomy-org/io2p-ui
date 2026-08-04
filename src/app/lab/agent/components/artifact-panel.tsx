'use client'

import {
  Bookmark,
  Check,
  Download,
  LayoutDashboard,
  Pencil,
  Sigma,
  TriangleAlert,
  X,
} from 'lucide-react'

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { WidgetCard } from '../../overviews/components/widget-card'

import type { Artifact } from '../fixtures'

/**
 * The side panel, opened from a reference in the thread.
 *
 * It is a PEER of the conversation, not a modal over it: the whole point is to keep asking
 * questions while looking at the result, which a dialog forbids by design. That also decides the
 * actions — an artifact's job is to leave the chat and become something permanent, so "Add to a
 * dashboard" is the primary button rather than "Close".
 */
export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact
  onClose: () => void
}) {
  return (
    <aside
      className="flex w-[26rem] shrink-0 flex-col border-l duration-200 animate-in slide-in-from-right motion-reduce:animate-none"
      aria-label={`${artifact.title} panel`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {artifact.title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {artifact.kind === 'widget' && <WidgetCard widget={artifact.widget} />}

        {artifact.kind === 'table' && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {artifact.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {artifact.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="text-sm">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {artifact.kind === 'note' && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {artifact.markdown}
          </p>
        )}

        {artifact.kind === 'draft' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm">
                Nothing is saved yet. Objects cannot be un-created here — only
                soft-deleted afterwards — so review before you commit.
              </p>
            </div>
            <ul className="rounded-lg border">
              {artifact.nodes.map((node) => (
                <li
                  key={node.name}
                  className="flex items-baseline gap-2 border-b px-3 py-2 last:border-b-0"
                  style={{ paddingLeft: `${node.level * 1.25 + 0.75}rem` }}
                >
                  <span className="text-sm font-medium">{node.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {node.properties}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {artifact.kind === 'formula' && (
          <div className="space-y-3">
            <code className="block rounded-md bg-muted p-3 text-sm">
              {artifact.expression}
            </code>
            {/* Where each variable came from is the whole point. A computed value nobody can
                trace is a number people quietly stop believing. */}
            <div className="rounded-lg border">
              {artifact.bindings.map((binding) => (
                <div
                  key={binding.variable}
                  className="flex items-baseline gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <code className="text-sm">{binding.variable}</code>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {binding.source}
                  </span>
                  <span className="text-sm tabular-nums">{binding.value}</span>
                </div>
              ))}
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Result</span>{' '}
              <span className="font-medium tabular-nums">
                {artifact.result}
              </span>
            </p>
          </div>
        )}

        {artifact.kind === 'view' && (
          <div className="space-y-3">
            <ul className="space-y-1">
              {artifact.conditions.map((condition) => (
                <li
                  key={condition}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  {condition}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground tabular-nums">
              Matches {artifact.matches} objects right now.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t p-3">
        {/* The primary action is always "leave the chat and become permanent" — that is what
            separates an artifact from a paragraph. It differs per kind because the destination
            does. */}
        {artifact.kind === 'widget' && (
          <Button type="button" className="w-full gap-2">
            <LayoutDashboard className="size-4" />
            Add to a dashboard
          </Button>
        )}
        {artifact.kind === 'draft' && (
          <Button type="button" className="w-full gap-2">
            <Check className="size-4" />
            Create {artifact.nodes.length} objects
          </Button>
        )}
        {artifact.kind === 'formula' && (
          <Button type="button" className="w-full gap-2">
            <Sigma className="size-4" />
            Save to the library
          </Button>
        )}
        {artifact.kind === 'view' && (
          <Button type="button" className="w-full gap-2">
            <Bookmark className="size-4" />
            Save as a view
          </Button>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
          >
            <Pencil className="size-3.5" />
            Refine
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>
    </aside>
  )
}
