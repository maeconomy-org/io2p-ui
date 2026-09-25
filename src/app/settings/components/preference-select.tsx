'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

export interface PreferenceOption<T extends string> {
  value: T
  label: string
}

/**
 * A settings row's control, where a segmented control cannot fit.
 *
 * `SegmentedControl` collapses on mobile by falling back to an icon or a short code, and the access
 * levels have neither — "Shared with me" has no two-letter form and no icon that would not be a
 * guess. Five of them side by side also read as five unrelated decisions rather than one applied
 * five times.
 */
export function PreferenceSelect<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  testId,
}: {
  options: PreferenceOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  testId?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        aria-label={ariaLabel}
        data-testid={testId ? `${testId}-trigger` : undefined}
        className="h-9 w-[11rem]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            data-testid={testId ? `${testId}-${opt.value}` : undefined}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
