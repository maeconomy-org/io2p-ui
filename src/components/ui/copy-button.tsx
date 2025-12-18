'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { logger, cn } from '@/lib'
import { Button } from './button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

interface CopyButtonProps {
  text: string
  label?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'ghost' | 'outline' | 'secondary'
  className?: string
  showToast?: boolean
  iconSize?: 'sm' | 'default'
}

export function CopyButton({
  text,
  label,
  size = 'sm',
  variant = 'ghost',
  className,
  showToast = true,
  iconSize = 'sm',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (e?: React.MouseEvent) => {
    // Prevent event bubbling if used inside clickable elements
    e?.stopPropagation()

    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)

      if (showToast) {
        toast.success(
          label ? `${label} copied to clipboard` : 'Copied to clipboard'
        )
      }

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      if (showToast) {
        toast.error('Failed to copy to clipboard')
      }
      logger.error('Failed to copy:', error)
    }
  }

  const iconClassName = cn(
    iconSize === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
    copied && 'text-green-500'
  )

  const buttonClassName = cn(
    'transition-colors',
    size === 'sm' && 'h-6 w-6 p-0',
    className
  )

  const tooltipText = copied
    ? 'Copied!'
    : label
      ? `Copy ${label}`
      : 'Copy to clipboard'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild tabIndex={-1}>
          <Button
            variant={variant}
            size={size}
            onClick={copyToClipboard}
            className={buttonClassName}
            aria-label={tooltipText}
          >
            {copied ? (
              <Check className={iconClassName} />
            ) : (
              <Copy className={iconClassName} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
