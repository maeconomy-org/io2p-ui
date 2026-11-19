/**
 * Each sheet must hand its form's save error to the shell. The prop is
 * required, but `undefined` satisfies the type, so only this can see a sheet
 * that passes the wrong value.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import { EMPTY_PROCESS_DRAFT } from '@/lib/entity/process'

const SAVE_ERROR = 'objects.saveError.invalid:{"detail":"key taken"}'

const shellProps = vi.hoisted(() => ({ saveError: [] as unknown[] }))

vi.mock('@/components/entity-sheet/entity-sheet-shell', () => ({
  EntitySheetShell: (props: { saveError: unknown }) => {
    shellProps.saveError.push(props.saveError)
    return null
  },
}))

// Module-level: a new `errors` object per render would make react-hook-form
// apply it again on every render.
const FAILED = { root: { save: { type: 'server', message: SAVE_ERROR } } }

function useFailedForm() {
  // An entity draft with every list empty, which all three sheets can read.
  const form = useForm({ defaultValues: EMPTY_PROCESS_DRAFT, errors: FAILED })
  return { form, submit: vi.fn(), isSubmitting: false }
}
vi.mock('@/components/entity-sheet/hooks/use-entity-form', () => ({
  useEntityForm: () => useFailedForm(),
}))
vi.mock('@/components/entity-sheet/hooks/use-process-form', () => ({
  useProcessForm: () => useFailedForm(),
}))
vi.mock('@/components/entity-sheet/hooks/use-template-form', () => ({
  useTemplateForm: () => useFailedForm(),
}))

// Any member is a hook returning the same idle query, every time: fresh objects
// per render would re-run the sheets' effects without end.
const IDLE_QUERY = { data: undefined, isLoading: false, mutateAsync: () => {} }
const IDLE_MEMBER = () => IDLE_QUERY
const IDLE = new Proxy(
  {},
  { get: (_t, key) => (key === 'then' ? undefined : IDLE_MEMBER) }
)
function idle() {
  return IDLE
}
vi.mock('@/components/entity-sheet/hooks/use-entity-lifecycle', () => ({
  useEntityLifecycle: () => idle(),
}))
vi.mock('@/components/entity-sheet/hooks/use-sheet-draft', () => ({
  useSheetDraft: () => idle(),
}))
vi.mock('@/hooks/api/entities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useObjects: () => idle(),
  useProcesses: () => idle(),
  useTemplates: () => idle(),
}))
vi.mock('@/hooks/api/rollup-rules', () => ({ useRollupRules: () => idle() }))
vi.mock('@/hooks/drafts', () => ({ useObjectDrafts: () => idle() }))
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userId: 'u1' }),
}))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { EntitySheet } from '@/components/entity-sheet/entity-sheet'
import { ProcessSheet } from '@/components/entity-sheet/process-sheet'
import { TemplateSheet } from '@/components/entity-sheet/template-sheet'

beforeEach(() => {
  shellProps.saveError.length = 0
})

describe.each([
  ['object', () => <EntitySheet open onOpenChange={vi.fn()} />],
  ['process', () => <ProcessSheet open onOpenChange={vi.fn()} />],
  ['template', () => <TemplateSheet open onOpenChange={vi.fn()} />],
])('the %s sheet', (_name, sheet) => {
  it("passes its form's save error to the shell", () => {
    render(sheet())

    expect(shellProps.saveError.at(-1)).toBe(SAVE_ERROR)
  })
})
