'use client'

import { useState } from 'react'
import {
  ArrowUp,
  Blocks,
  Paperclip,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from '@/components/ui'

import { SKILLS } from '../fixtures'

/**
 * The composer, identical in the empty state and mid-thread.
 *
 * One component rather than two arrangements: the empty state centres it and the thread pins it
 * to the bottom, but a second copy would be a second place for the skills picker to drift.
 */
export function Composer({
  onSend,
  autoFocus,
}: {
  onSend: (text: string) => void
  autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const [enabled, setEnabled] = useState<string[]>([
    'search',
    'summarise',
    'dashboard',
  ])

  const writeSkills = SKILLS.filter(
    (s) => s.writes && enabled.includes(s.id)
  ).length

  const submit = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    // One ring, on the wrapper. The textarea keeps its own `focus-visible` ring by default, so
    // both drew at once and the corners showed two radii — the artefact in the screenshot.
    <div className="rounded-xl border bg-background shadow-sm transition-shadow focus-within:border-ring">
      <Textarea
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Ask the agent…"
        aria-label="Ask the agent"
        rows={2}
        className="min-h-[3.5rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />

      <div className="flex items-center gap-2 px-3 pb-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
            >
              <Blocks className="h-3.5 w-3.5" />
              Skills
              <span className="tabular-nums">{enabled.length}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              What the agent may use this turn.
            </p>
            {SKILLS.map((skill) => (
              <label
                key={skill.id}
                className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted"
              >
                <Checkbox
                  checked={enabled.includes(skill.id)}
                  onCheckedChange={(checked) =>
                    setEnabled((prev) =>
                      checked
                        ? [...prev, skill.id]
                        : prev.filter((id) => id !== skill.id)
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {skill.label}
                    {/* A writing skill is labelled as one. In an append-only store, an
                        unexpected create is not undoable — only soft-deletable after the fact. */}
                    {skill.writes && (
                      <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <TriangleAlert className="h-2.5 w-2.5" />
                        writes objects
                      </span>
                    )}
                    {/* `builds` is a different risk class from `writes`: a dashboard is yours to
                        delete, an object in an append-only store is not. Same badge for both
                        would teach people to ignore the one that matters. */}
                    {skill.builds && (
                      <span className="flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-normal text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        builds
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {skill.description}
                  </span>
                </span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {writeSkills > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            can create objects
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            className={cn('h-8 w-8 rounded-full')}
            disabled={!text.trim()}
            onClick={submit}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
