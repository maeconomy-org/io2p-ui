'use client'

import {
  ArrowUpRight,
  Boxes,
  FileText,
  ImageIcon,
  PanelRight,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

import type { Artifact, Part } from '../fixtures'
import { ARTIFACTS } from '../fixtures'

/** Deliberately dumb markdown: bold, code, bullets. The layout question is rhythm, not syntax. */
function Markdown({ text }: { text: string }) {
  const inline = (value: string) =>
    value
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /`(.+?)`/g,
        '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>'
      )

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split('\n\n').map((block, i) =>
        block.startsWith('- ') ? (
          <ul key={i} className="space-y-1">
            {block.split('\n').map((line, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: inline(line.replace(/^- /, '')),
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} dangerouslySetInnerHTML={{ __html: inline(block) }} />
        )
      )}
    </div>
  )
}

const ARTIFACT_LABEL: Record<Artifact['kind'], string> = {
  widget: 'Chart',
  table: 'Table',
  note: 'Note',
  draft: 'Proposal — nothing saved yet',
  formula: 'Formula',
  view: 'Saved view',
}

/**
 * An artifact appears in the thread as a REFERENCE, not as the thing itself.
 *
 * A chart inlined at message width is too small to read and pushes the conversation off screen;
 * the same chart in a side panel keeps its size while you keep asking questions about it. The
 * card carries enough to know what it is without opening — which is the difference between a
 * reference and a mystery link.
 */
function ArtifactCard({
  artifact,
  active,
  onOpen,
}: {
  artifact: Artifact
  active: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      className={cn(
        'group/artifact flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
        <PanelRight className="size-4 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {artifact.title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {ARTIFACT_LABEL[artifact.kind]} ·{' '}
          {active ? 'open in the panel' : 'click to open'}
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/artifact:opacity-100" />
    </button>
  )
}

export function MessageParts({
  parts,
  activeArtifactId,
  onOpenArtifact,
}: {
  parts: Part[]
  activeArtifactId: string | null
  onOpenArtifact: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {parts.map((part, index) => {
        if (part.kind === 'text')
          return <Markdown key={index} text={part.text} />

        if (part.kind === 'image')
          return (
            <figure key={index} className="space-y-1">
              {/* No real asset in the lab — a labelled placeholder is more honest than a stock
                  photo, and it still answers the layout question of how wide an image sits. */}
              <div className="flex aspect-[4/3] max-w-sm items-center justify-center rounded-lg border bg-muted/40">
                <ImageIcon className="size-8 text-muted-foreground/40" />
                <span className="sr-only">{part.alt}</span>
              </div>
              {part.caption && (
                <figcaption className="text-xs text-muted-foreground">
                  {part.caption}
                </figcaption>
              )}
            </figure>
          )

        if (part.kind === 'file')
          return (
            <div
              key={index}
              className="flex max-w-sm items-center gap-2 rounded-lg border p-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{part.name}</span>
                <span className="block text-xs uppercase text-muted-foreground">
                  {part.mime} · {part.size}
                </span>
              </span>
            </div>
          )

        if (part.kind === 'objects')
          return (
            <div key={index} className="rounded-lg border">
              {/* The citation. A number nobody can trace back to rows is a number nobody can
                  check, and this is the cheapest place to make an agent answer auditable. */}
              <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
                <Boxes className="size-3.5" />
                Based on {part.items.length} objects
              </p>
              <ul className="divide-y">
                {part.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 text-xs text-muted-foreground"
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )

        const artifact = ARTIFACTS[part.artifactId]
        if (!artifact) return null
        return (
          <ArtifactCard
            key={index}
            artifact={artifact}
            active={activeArtifactId === artifact.id}
            onOpen={() => onOpenArtifact(artifact.id)}
          />
        )
      })}
    </div>
  )
}
