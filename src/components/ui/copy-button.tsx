'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
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
  const t = useTranslations('copyButton')

  const copyToClipboard = async (e?: React.MouseEvent) => {
    // Prevent event bubbling if used inside clickable elements
    e?.stopPropagation()

    if (!text) return

    if (!(await copyText(text))) {
      if (showToast) toast.error(t('failedToCopy'))
      return
    }

    setCopied(true)
    if (showToast) {
      toast.success(
        label ? t('copiedWithLabel', { label }) : t('copiedToClipboard')
      )
    }
    setTimeout(() => setCopied(false), 2000)
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
    ? t('copied')
    : label
      ? t('copyLabel', { label })
      : t('copyToClipboard')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild tabIndex={-1}>
          <Button
            // Without this it defaults to submit, so copying an id inside a sheet saves the form.
            type="button"
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
