'use client'

import {
  Boxes,
  Calendar,
  Layers,
  Link2,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  Share2,
  Sigma,
  Tag,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Button } from '@/components/ui'

import { SeededAvatar } from '../../components/seeded-avatar'

export interface BrowseItem {
  id: string
  name: string
  parent: string
  type: string
  owner: string
  area: string
  children: number
  condition: string
}

const PROPERTIES = [
  {
    key: 'area',
    label: 'Floor area',
    values: [
      { data: '24 m²', num: '24 m²', files: ['measured-2026-06.pdf'] },
      {
        data: '23.6 m²',
        num: '23.6 m²',
        files: ['as-built-plan.pdf', 'Cadastre record'],
      },
    ],
  },
  {
    key: 'use',
    label: 'Use',
    values: [{ data: 'Office' }, { data: 'Archive' }],
  },
  {
    key: 'materials',
    label: 'Materials',
    values: [{ data: 'Concrete' }, { data: 'Steel' }, { data: 'Glass' }],
  },
  { key: 'mass', label: 'Mass', values: [{ data: '3.26 t', num: '3260 kg' }] },
  {
    key: 'co2',
    label: 'Embodied CO₂',
    formula: 'mass * co2_factor',
    values: [{ data: '1369.2', num: '1369.2 kg' }],
  },
]

const OVERVIEW = [
  { title: 'Reusable material', value: '62%', verdict: 'Good', tone: 'good' },
  {
    title: 'Recycled content',
    value: '38%',
    verdict: 'Below target',
    tone: 'warn',
  },
  {
    title: 'Estimated value',
    value: '€248k',
    verdict: 'Derived',
    tone: 'flat',
  },
  { title: 'Data completeness', value: '84%', verdict: 'Fair', tone: 'warn' },
]

const TONES: Record<string, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  flat: 'text-muted-foreground',
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </div>
  )
}

/**
 * The same object, laid out for the width it has.
 *
 * `wide` is not a bigger font — it is a different COLUMN COUNT. At panel width everything
 * stacks; with the list hidden, facts and overview sit side by side and properties run two
 * across, which is where multi-value properties stop wrapping into a ragged column of chips.
 */
export function DetailBody({
  item,
  wide,
}: {
  item: BrowseItem
  wide: boolean
}) {
  return (
    <div className={cn('mx-auto p-5', wide ? 'max-w-6xl' : 'max-w-3xl')}>
      <div className="flex items-start gap-4 pb-5">
        <SeededAvatar
          seed={`${item.parent}/${item.name}`}
          square
          className="size-16"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-semibold">{item.name}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {item.type} in {item.parent}
          </p>
          <div className="flex flex-wrap gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Share2 className="size-3.5" />
              Share
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Add child
            </Button>
            <Button type="button" variant="outline" size="sm">
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-5 border-t pt-5',
          wide ? 'grid-cols-2' : 'grid-cols-1'
        )}
      >
        <section>
          <h3 className="pb-1 text-sm font-medium">Details</h3>
          <Fact icon={Layers} label="Parents">
            <span className="flex flex-wrap gap-1">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {item.parent.split('›').pop()?.trim()}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                Fire compartment 3
              </span>
            </span>
          </Fact>
          <Fact icon={MapPin} label="Address">
            1200 Harbor Boulevard, Portland OR 97204, US
          </Fact>
          <Fact icon={User} label="Owner">
            <span className="flex items-center gap-1.5">
              <SeededAvatar seed={item.owner} className="size-4" />
              {item.owner}
            </span>
          </Fact>
          <Fact icon={Calendar} label="Created">
            24 Jun 2026 by Anna Roos
          </Fact>
          <Fact icon={Tag} label="Created from">
            <Badge variant="template" className="font-normal">
              Room
            </Badge>
          </Fact>
          <Fact icon={Boxes} label="Children">
            <span className="tabular-nums">{item.children}</span>
          </Fact>
        </section>

        <section>
          <h3 className="pb-2 text-sm font-medium">Overview</h3>
          <div className="grid grid-cols-2 gap-2">
            {OVERVIEW.map((card) => (
              <div key={card.title} className="rounded-lg border px-3 py-2">
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold tabular-nums">
                    {card.value}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'px-1.5 py-0 text-[10px] font-normal',
                      TONES[card.tone]
                    )}
                  >
                    {card.verdict}
                  </Badge>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="border-t pt-5">
        <h3 className="pb-2 text-sm font-medium">Properties</h3>
        <div className={cn('grid gap-3', wide ? 'grid-cols-2' : 'grid-cols-1')}>
          {PROPERTIES.map((property) => (
            <div key={property.key} className="rounded-lg border p-3">
              <div className="flex items-baseline gap-2 pb-2">
                <p className="text-sm font-medium">{property.label}</p>
                <code className="text-xs text-muted-foreground">
                  {property.key}
                </code>
                {property.formula && (
                  <span className="flex items-center gap-1 rounded border border-fuchsia-200 bg-fuchsia-50 px-1.5 py-0.5 text-[11px] text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300">
                    <Sigma className="size-3" />
                    <code>{property.formula}</code>
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {property.values.map((value, index) => (
                  <div key={index} className="space-y-1">
                    <span className="flex items-baseline gap-1.5 rounded border px-2 py-1 text-sm">
                      {value.data}
                      {'num' in value && value.num && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          = {value.num}
                        </span>
                      )}
                      {property.formula && (
                        <Lock className="size-3 text-muted-foreground" />
                      )}
                    </span>
                    {'files' in value && value.files && (
                      <div className="flex flex-wrap gap-1 pl-2">
                        {value.files.map((file) => (
                          <span
                            key={file}
                            className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {file.endsWith('.pdf') ? (
                              <Paperclip className="size-3" />
                            ) : (
                              <Link2 className="size-3" />
                            )}
                            {file}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
