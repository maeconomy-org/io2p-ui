'use client'

import { useState } from 'react'
import {
  BarChart3,
  Bot,
  Boxes,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Sigma,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

import { ArtifactPanel } from './components/artifact-panel'
import { Composer } from './components/composer'
import { MessageParts } from './components/message-parts'
import type { Conversation, Message, Part } from './fixtures'
import { ARTIFACTS, CONVERSATIONS, EXAMPLES, groupByDay } from './fixtures'

const EXAMPLE_ICONS = { boxes: Boxes, chart: BarChart3, sigma: Sigma }

/**
 * Stand-in replies keyed by intent. Real turns will stream; what matters here is that different
 * questions produce different SHAPES of answer, which is the thing the parts model exists for.
 */
function replyTo(text: string): Part[] {
  if (/draft|create|add .*(rooms|floors|objects)/i.test(text)) {
    return [
      {
        kind: 'text',
        text: 'I have drafted this from what you described. **Nothing is saved** — open it to review, then create.',
      },
      { kind: 'artifact', artifactId: 'a3' },
    ]
  }
  if (/formula|calculat|co2|why is|how is .* computed/i.test(text)) {
    return [
      {
        kind: 'text',
        text: 'That value comes from a formula. Here is what fed it, including which constant version was pinned.',
      },
      { kind: 'artifact', artifactId: 'a4' },
    ]
  }
  if (/find|which|needing|filter|list/i.test(text)) {
    return [
      {
        kind: 'text',
        text: 'I built a filter for that. Save it as a view and it will be one click tomorrow.',
      },
      { kind: 'artifact', artifactId: 'a5' },
    ]
  }
  const wantsChart = /chart|graph|dashboard|widget|plot/i.test(text)
  if (wantsChart) {
    return [
      {
        kind: 'text',
        text: 'I read that as **sum of `area`, grouped by parent**. Open it to change the measure, or keep it on a dashboard.',
      },
      { kind: 'artifact', artifactId: 'a1' },
    ]
  }
  return [
    {
      kind: 'text',
      text: `Here's what I can do from this workspace:

- **Summarise** any object and everything under it
- **Chart** a question and hand you a widget to keep
- **Trace** a computed value back to its formula and constants
- **Draft** a tree of objects for you to review before anything is saved`,
    },
    { kind: 'text', text: 'Ask about a building, or try one of the examples.' },
  ]
}

function Bubble({
  message,
  activeArtifactId,
  onOpenArtifact,
}: {
  message: Message
  activeArtifactId: string | null
  onOpenArtifact: (id: string) => void
}) {
  const parts = (
    <MessageParts
      parts={message.parts}
      activeArtifactId={activeArtifactId}
      onOpenArtifact={onOpenArtifact}
    />
  )

  if (message.role === 'user') {
    return (
      <div className="flex justify-end duration-300 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
        <div className="max-w-[75%] rounded-2xl bg-muted px-4 py-2">
          {parts}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 duration-500 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
        <Bot className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">{parts}</div>
    </div>
  )
}

export default function AgentPage() {
  const [conversations, setConversations] =
    useState<Conversation[]>(CONVERSATIONS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [artifactId, setArtifactId] = useState<string | null>(null)

  const active = conversations.find((c) => c.id === activeId) ?? null
  const messages = active?.messages ?? []
  const artifact = artifactId ? ARTIFACTS[artifactId] : null

  const send = (text: string) => {
    const now = 1754301600000
    const userMessage: Message = {
      id: `m${now}`,
      role: 'user',
      parts: [{ kind: 'text', text }],
      createdAt: now,
    }
    const reply: Message = {
      id: `m${now + 1}`,
      role: 'agent',
      parts: replyTo(text),
      createdAt: now + 1,
    }

    if (active) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? { ...c, messages: [...c.messages, userMessage, reply] }
            : c
        )
      )
      return
    }

    // A new conversation is TITLED, not labelled with the raw prompt — a title is renameable and
    // survives the first message being edited or deleted.
    const created: Conversation = {
      id: `c${now}`,
      title: text.length > 48 ? `${text.slice(0, 48)}…` : text,
      updatedAt: now,
      messages: [userMessage, reply],
    }
    setConversations((prev) => [created, ...prev])
    setActiveId(created.id)
  }

  return (
    <div className="flex h-full">
      {/* Width, not display — a panel that animates from 16rem to 0 keeps its contents mounted,
          so scroll position and focus survive a collapse. `hidden` would throw both away. */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r transition-[width] duration-300 motion-reduce:transition-none',
          historyOpen ? 'w-64' : 'w-0'
        )}
      >
        <div className="w-64 shrink-0 p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              setActiveId(null)
              setArtifactId(null)
            }}
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
        </div>

        <div className="w-64 flex-1 overflow-y-auto px-2 pb-2">
          {groupByDay(conversations).map((group) => (
            <div key={group.label} className="pb-3">
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-md transition-colors',
                    activeId === conversation.id && 'bg-muted'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(conversation.id)
                      setArtifactId(null)
                    }}
                    className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {conversation.title}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete ${conversation.title}`}
                    onClick={() =>
                      setConversations((prev) =>
                        prev.filter((c) => c.id !== conversation.id)
                      )
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-label={historyOpen ? 'Hide chat history' : 'Show chat history'}
            aria-expanded={historyOpen}
          >
            {historyOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
          <p className="truncate text-sm font-medium">
            {active?.title ?? 'New chat'}
          </p>
        </div>

        {messages.length === 0 ? (
          // The empty state centres the composer, because with nothing to read the input IS the
          // page. Once a thread exists it drops to the bottom and the history becomes the page.
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
            <div className="w-full max-w-2xl space-y-6 duration-500 animate-in fade-in slide-in-from-bottom-3 motion-reduce:animate-none">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl border bg-muted/40">
                  <Bot className="size-6 text-muted-foreground" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Ask about anything in this workspace.
                </p>
              </div>

              <Composer onSend={send} autoFocus />

              <div>
                <p className="pb-2 text-sm text-muted-foreground">
                  Get started with some examples
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {EXAMPLES.map((example) => {
                    const Icon = EXAMPLE_ICONS[example.icon]
                    return (
                      <button
                        key={example.title}
                        type="button"
                        onClick={() => send(example.title)}
                        className="rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
                      >
                        <Icon className="mb-2 size-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{example.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {example.body}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl space-y-6">
                {messages.map((message) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    activeArtifactId={artifactId}
                    onOpenArtifact={setArtifactId}
                  />
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t p-4">
              <div className="mx-auto max-w-2xl">
                <Composer onSend={send} />
              </div>
            </div>
          </>
        )}
      </div>

      {artifact && (
        <ArtifactPanel
          artifact={artifact}
          onClose={() => setArtifactId(null)}
        />
      )}
    </div>
  )
}
