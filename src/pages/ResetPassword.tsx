import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from '@/components/ui/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { toast } from '@/components/ui/Toast'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) {
      toast(error, 'error')
      return
    }

    setSuccess(true)
    toast('Password updated successfully!', 'success')

    setTimeout(() => {
      navigate('/login')
    }, 3000)
  }

  if (success) {
    return (
      <AuthLayout
        title="Password updated!"
        subtitle="Your password has been reset successfully"
      >
        <div className="text-center space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50 dark:bg-success-500/10">
            <CheckCircle2 className="h-8 w-8 text-success-500" />
          </div>

          <p className="text-sm text-surface-600 dark:text-surface-400">
            You will be redirected to the login page shortly...
          </p>

          <Button
            onClick={() => navigate('/login')}
            variant="primary"
            className="w-full"
            size="lg"
          >
            Go to Sign In
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter a new password for your account"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Input
            id="reset-password"
            label="New Password"
            type="password"
            placeholder="Create a new password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
            }}
            error={errors.password}
            icon={<Lock size={18} />}
            autoComplete="new-password"
            autoFocus
          />
          <PasswordStrength password={password} />
        </div>

        <Input
          id="reset-confirm-password"
          label="Confirm New Password"
          type="password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }))
          }}
          error={errors.confirmPassword}
          icon={<Lock size={18} />}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          size="lg"
        >
          Update Password
        </Button>
      </form>
    </AuthLayout>
  )
}
