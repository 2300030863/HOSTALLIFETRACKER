import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

let addToast: (message: string, type: ToastType) => void = () => {}

export function toast(message: string, type: ToastType = 'info') {
  addToast(message, type)
}

export const showToast = {
  success: (message: string) => toast(message, 'success'),
  error: (message: string) => toast(message, 'error'),
  info: (message: string) => toast(message, 'info'),
  warning: (message: string) => toast(message, 'warning'),
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    addToast = (message: string, type: ToastType) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, type }])

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    }
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-rose-500" />,
    info: <Info size={18} className="text-blue-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
  }

  const styles = {
    success: 'border-l-4 border-l-emerald-500',
    error: 'border-l-4 border-l-rose-500',
    info: 'border-l-4 border-l-blue-500',
    warning: 'border-l-4 border-l-amber-500',
  }

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto animate-slide-down',
            'flex items-start gap-3 rounded-xl p-4',
            'bg-white shadow-lg dark:bg-surface-800',
            'border border-surface-200 dark:border-surface-700',
            styles[t.type]
          )}
        >
          <span className="mt-0.5 flex-shrink-0">{icons[t.type]}</span>
          <p className="flex-1 text-sm font-medium text-surface-700 dark:text-surface-200">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="flex-shrink-0 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
