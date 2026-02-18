import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface StepsProps {
  children: ReactNode
  currentStep: number
}

interface StepProps {
  title: string
}

export function Steps({ children, currentStep }: StepsProps) {
  const steps = React.Children.toArray(
    children
  ) as React.ReactElement<StepProps>[]

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={step.props.title} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border-2 text-xs font-medium',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-xs font-medium',
                  isCurrent
                    ? 'text-primary'
                    : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                )}
              >
                {step.props.title}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  'h-0.5 w-6 mx-1',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Step() {
  return null // This is just a data component, doesn't render anything
}
