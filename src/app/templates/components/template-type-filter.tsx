import type { FilterSection } from '@/components/filters'

/** `undefined` = both kinds. */
export type TemplateTypeFilterValue = 'object' | 'process' | undefined

/**
 * Object vs process templates. `type` is a real list-query param, so this narrows server-side like
 * the owner and status sections beside it — one table, one pagination, and search still spans both.
 *
 * `single` because the two are exclusive: "object AND process" would match nothing, which would read
 * as an empty library rather than as an impossible question.
 */
export function templateTypeSection(
  t: (key: string) => string,
  value: TemplateTypeFilterValue,
  onChange: (next: TemplateTypeFilterValue) => void
): FilterSection {
  return {
    key: 'type',
    label: t('templates.fields.type'),
    options: [
      { value: 'object', label: t('templates.typeObject') },
      { value: 'process', label: t('templates.typeProcess') },
    ],
    selected: value ? [value] : [],
    onChange: (values) =>
      onChange((values[0] as TemplateTypeFilterValue) ?? undefined),
    single: true,
  }
}
