import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-prahari-cyan/20 border border-prahari-cyan/40 text-prahari-cyan hover:bg-prahari-cyan/30',
        destructive: 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30',
        outline: 'border border-prahari-border bg-transparent text-prahari-muted hover:bg-prahari-surface hover:text-foreground',
        secondary: 'bg-prahari-surface border border-prahari-border text-foreground hover:bg-prahari-card',
        ghost: 'hover:bg-prahari-surface hover:text-foreground text-prahari-muted',
        link: 'text-prahari-cyan underline-offset-4 hover:underline',
        warning: 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30',
        success: 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
