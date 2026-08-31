import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-prahari-cyan/30 bg-prahari-cyan/10 text-prahari-cyan',
        critical: 'border-red-500/40 bg-red-500/10 text-red-400',
        high: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
        medium: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
        low: 'border-green-500/40 bg-green-500/10 text-green-400',
        online: 'border-green-500/40 bg-green-500/10 text-green-400',
        degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
        offline: 'border-red-500/40 bg-red-500/10 text-red-400',
        secondary: 'border-prahari-border bg-prahari-surface text-prahari-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
