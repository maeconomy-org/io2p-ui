'use client'

import type { ComponentProps, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export interface SplitButtonAction {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
}

/**
 * A primary action with related ones behind a chevron.
 *
 * TWO buttons, not one styled to look like two. A single control cannot carry
 * two behaviours for a keyboard or a screen reader — the secondary actions
 * would be unreachable — so each half is its own focusable button with its own
 * label, joined only by border radius and a divider.
 *
 * For actions that are ALTERNATIVES to the primary one ("copy here" beside "add
 * child"). A destructive action does not belong behind a chevron a hurried
 * click can open.
 */
export function SplitButton({
  children,
  onClick,
  actions,
  menuLabel,
  disabled,
  variant = 'default',
  size = 'default',
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'asChild'> & {
  actions: SplitButtonAction[]
  /** Accessible name for the chevron — it has no text of its own. */
  menuLabel: string
}) {
  if (actions.length === 0) {
    return (
      <Button
        onClick={onClick}
        disabled={disabled}
        variant={variant}
        size={size}
        className={className}
        {...props}
      >
        {children}
      </Button>
    )
  }

  return (
    <div className={cn('inline-flex', className)}>
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        variant={variant}
        size={size}
        className="rounded-r-none"
        {...props}
      >
        {children}
      </Button>
      {/* A hairline in the primary's own foreground, so the seam reads on every
          variant rather than only against a light fill. */}
      <span
        aria-hidden="true"
        className={cn(
          'w-px self-stretch',
          variant === 'outline' ? 'bg-input' : 'bg-primary-foreground/25'
        )}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            variant={variant}
            size={size}
            aria-label={menuLabel}
            className="rounded-l-none px-2"
            data-testid="split-button-trigger"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              onSelect={action.onSelect}
              disabled={action.disabled}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
