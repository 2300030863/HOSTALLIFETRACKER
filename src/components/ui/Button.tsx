import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: cn(
        'bg-primary-600 text-white',
        'hover:bg-primary-700 active:bg-primary-800',
        'shadow-lg shadow-primary-500/25',
        'hover:shadow-xl hover:shadow-primary-500/30',
        'dark:bg-primary-500 dark:hover:bg-primary-600'
      ),
      secondary: cn(
        'bg-surface-100 text-surface-900',
        'hover:bg-surface-200 active:bg-surface-300',
        'dark:bg-surface-800 dark:text-surface-100',
        'dark:hover:bg-surface-700'
      ),
      outline: cn(
        'border-2 border-surface-200 text-surface-700 bg-transparent',
        'hover:bg-surface-50 active:bg-surface-100',
        'dark:border-surface-700 dark:text-surface-300',
        'dark:hover:bg-surface-800'
      ),
      ghost: cn(
        'text-surface-600 bg-transparent',
        'hover:bg-surface-100 active:bg-surface-200',
        'dark:text-surface-400 dark:hover:bg-surface-800'
      ),
      danger: cn(
        'bg-danger-600 text-white',
        'hover:bg-danger-700 active:bg-danger-800',
        'shadow-lg shadow-danger-500/25'
      ),
    }

    const sizes = {
      sm: 'h-9 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-11 px-5 text-sm rounded-xl gap-2',
      lg: 'h-13 px-7 text-base rounded-xl gap-2.5',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
