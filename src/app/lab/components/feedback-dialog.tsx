'use client'

import { useState } from 'react'
import {
  Bug,
  Camera,
  Check,
  CircleHelp,
  Globe,
  Heart,
  Lightbulb,
  Send,
  Terminal,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Textarea,
} from '@/components/ui'

type Kind = 'bug' | 'idea' | 'question' | 'praise'
type Stage = 'kind' | 'detail' | 'sent'

/**
 * Colour carries the KIND, never alone — each tile pairs its hue with an icon and a word, so the
 * four are told apart without relying on seeing the difference between red and amber.
 */
const KINDS: {
  id: Kind
  label: string
  icon: typeof Bug
  tint: string
  prompt: string
}[] = [
  {
    id: 'bug',
    label: 'Bug',
    icon: Bug,
    tint: 'text-rose-600 dark:text-rose-400',
    prompt: 'What happened? What did you expect?',
  },
  {
    id: 'idea',
    label: 'Idea',
    icon: Lightbulb,
    tint: 'text-amber-600 dark:text-amber-400',
    prompt: 'What would you like to be able to do?',
  },
  {
    id: 'question',
    label: 'Question',
    icon: CircleHelp,
    tint: 'text-sky-600 dark:text-sky-400',
    prompt: 'What are you trying to work out?',
  },
  {
    id: 'praise',
    label: 'Praise',
    icon: Heart,
    tint: 'text-emerald-600 dark:text-emerald-400',
    prompt: 'What worked well?',
  },
]

/**
 * What rides along with the report. Each is a TOGGLE with a live count, not a silent capture:
 * "18 requests captured" is the difference between consent and surveillance, and it is also the
 * line that makes someone leave it on.
 */
const ATTACHMENTS = [
  {
    id: 'screenshot',
    icon: Camera,
    label: 'Screenshot',
    detail: 'The current page, before you opened this',
  },
  {
    id: 'console',
    icon: Terminal,
    label: 'Console & network',
    detail: '1 error · 18 requests captured',
  },
  {
    id: 'session',
    icon: Globe,
    label: 'Session context',
    detail: 'URL · viewport · browser · app version',
  },
] as const

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [stage, setStage] = useState<Stage>('kind')
  const [kind, setKind] = useState<Kind>('bug')
  const [body, setBody] = useState('')
  const [attached, setAttached] = useState<Record<string, boolean>>({
    screenshot: true,
    console: true,
    session: true,
  })

  const active = KINDS.find((k) => k.id === kind) ?? KINDS[0]!

  const reset = () => {
    setStage('kind')
    setBody('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setTimeout(reset, 200)
      }}
    >
      <DialogContent className="sm:max-w-md">
        {/* DialogContent's own `gap-4` sits on the OUTER grid, whose only child is an inner
            `flex flex-col` wrapper with no gap — so the gap separates nothing and every child
            here touched the next. Spacing has to be owned by the content. */}
        {stage === 'kind' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Send feedback</DialogTitle>
              <DialogDescription>
                Bugs, ideas or questions — goes straight to the team.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {KINDS.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setKind(option.id)
                      setStage('detail')
                    }}
                    className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className={cn('h-5 w-5', option.tint)} />
                    <span className="font-medium">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {stage === 'detail' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Tell us more</DialogTitle>
              <DialogDescription>The more detail the better.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2 pt-1">
              {KINDS.map((option) => {
                const Icon = option.icon
                const selected = option.id === kind
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setKind(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon
                      className={cn('h-3.5 w-3.5', selected && option.tint)}
                    />
                    {option.label}
                  </button>
                )
              })}
            </div>

            <Textarea
              value={body}
              className="min-h-[6rem] resize-none"
              onChange={(e) => setBody(e.target.value)}
              placeholder={active.prompt}
              rows={4}
              aria-label="Your feedback"
            />

            <Input
              type="email"
              placeholder="Your email (optional, so we can follow up)"
              aria-label="Your email"
            />

            <div className="divide-y overflow-hidden rounded-md border">
              {ATTACHMENTS.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <Switch
                      checked={attached[item.id] ?? false}
                      onCheckedChange={(checked) =>
                        setAttached((prev) => ({ ...prev, [item.id]: checked }))
                      }
                      aria-label={`Attach ${item.label}`}
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStage('kind')}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                disabled={body.trim().length === 0}
                onClick={() => setStage('sent')}
              >
                <Send className="h-4 w-4" />
                Send feedback
              </Button>
            </div>

            <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              Passwords auto-blurred · GDPR compliant · EU data residency
            </p>
          </div>
        )}

        {stage === 'sent' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div>
              <DialogTitle>Feedback received</DialogTitle>
              <DialogDescription className="mt-1">
                The team has been notified. Your session logs are attached so
                they can reproduce it fast.
              </DialogDescription>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
