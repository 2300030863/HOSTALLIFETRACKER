import { cn } from '@/utils/cn'

interface PasswordStrengthProps {
  password: string
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z\d]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-danger-500' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-warning-500' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-info-500' }
  if (score <= 4) return { score, label: 'Strong', color: 'bg-success-500' }
  return { score, label: 'Very Strong', color: 'bg-success-600' }
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const { score, label, color } = getStrength(password)

  return (
    <div className="space-y-1.5 animate-slide-down">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i < score ? color : 'bg-surface-200 dark:bg-surface-700'
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'text-xs font-medium',
          score <= 1 && 'text-danger-500',
          score === 2 && 'text-warning-500',
          score === 3 && 'text-info-500',
          score >= 4 && 'text-success-500'
        )}
      >
        {label}
      </p>
    </div>
  )
}
