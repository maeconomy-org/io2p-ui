import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import type { ProcessGraph } from '@/app/processes/utils/process-graph'

// `next/dynamic` would defer the chart past the assertions; the charts themselves are canvas and
// have nothing to assert. Both are replaced by a button that reports a node click.
vi.mock('next/dynamic', () => ({
  default: () => FakeChart,
}))

function FakeChart({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onNodeClick?.('node-1')}>
      focus node-1
    </button>
  )
}

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}))

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

const graphResult = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}))

vi.mock('@/app/processes/hooks/use-process-graph', () => ({
  useProcessGraph: () => graphResult.current,
}))

import { ProcessFlowView } from '@/app/processes/components/process-flow-view'

const NODE: ProcessGraph['nodes'][number] = {
  id: 'node-1',
  kind: 'process',
  name: 'Smelt',
  role: 'hub',
}

const LINK: ProcessGraph['links'][number] = {
  source: 'obj-a',
  target: 'node-1',
  flowId: 'f1',
  processId: 'node-1',
  processName: 'Smelt',
  direction: 'input',
}

function setGraph(nodes: ProcessGraph['nodes']) {
  graphResult.current = {
    graph: { nodes, links: [LINK] },
    cutLinks: [],
    totalLevels: 3,
    totalNodes: nodes.length,
    units: [],
    truncated: false,
    isLoading: false,
    isResolvingNames: false,
    error: null,
  }
}

describe('ProcessFlowView focus bar', () => {
  beforeEach(() => {
    setGraph([NODE, { ...NODE, id: 'obj-a', kind: 'object', name: 'Scrap' }])
  })

  it('shows the bar once a node is focused', () => {
    render(<ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />)

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    expect(screen.getByRole('region')).toBeInTheDocument()
    expect(screen.getByText('Smelt')).toBeInTheDocument()
  })

  it('stays open while the focused node is missing from the fetched graph', () => {
    // The regression: focusing re-slices and re-reads, so `graph.nodes` briefly does not contain the
    // node. Driving the bar off that made it exit and re-enter mid-transition — the flicker.
    const { rerender } = render(
      <ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    setGraph([])
    rerender(<ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />)

    expect(screen.getByRole('region')).toBeInTheDocument()
  })

  it('falls back to the id rather than blanking the label mid-transition', () => {
    const { rerender } = render(
      <ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    setGraph([])
    rerender(<ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />)

    expect(screen.getByText('node-1')).toBeInTheDocument()
  })

  it('disables Open details until the node resolves, since its kind decides where that goes', () => {
    const { rerender } = render(
      <ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    setGraph([])
    rerender(<ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />)

    expect(screen.getByRole('button', { name: /openDetails/ })).toBeDisabled()
  })

  it('closes when the user clears the focus', () => {
    render(<ProcessFlowView variant="sankey" onOpenProcess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    fireEvent.click(screen.getByRole('button', { name: /nodeFocus.clear/ }))

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('opens the process sheet from the bar', () => {
    const onOpenProcess = vi.fn()
    render(<ProcessFlowView variant="sankey" onOpenProcess={onOpenProcess} />)
    fireEvent.click(screen.getByRole('button', { name: 'focus node-1' }))

    fireEvent.click(screen.getByRole('button', { name: /openDetails/ }))

    expect(onOpenProcess).toHaveBeenCalledWith('node-1')
  })
})
