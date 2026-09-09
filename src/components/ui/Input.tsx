import { forwardRef, type InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              {icon}
            </div>
          )}
          <input
            id={id}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            ref={ref}
            className={cn(
              'flex h-11 w-full rounded-xl border border-surface-200 bg-white px-4 py-2',
              'text-sm text-surface-900 placeholder:text-surface-400',
              'transition-all duration-200',
              'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100',
              'dark:placeholder:text-surface-500 dark:focus:border-primary-400',
              'dark:focus:ring-primary-400/20',
              icon && 'pl-10',
              isPassword && 'pr-10',
              error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'text-surface-400 hover:text-surface-600',
                'dark:text-surface-500 dark:hover:text-surface-300',
                'transition-colors duration-200'
              )}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-danger-500 animate-slide-down">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
