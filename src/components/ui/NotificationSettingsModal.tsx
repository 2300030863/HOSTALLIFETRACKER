import { useState, useEffect } from 'react'
import { Bell, X, Smartphone, ShieldCheck, Send } from 'lucide-react'
import {
  requestAndSubscribePush,
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/services/pushNotification'
import { showToast } from './Toast'
import { cn } from '@/utils/cn'

interface NotificationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DiagnosticState {
  isHttpsOrLocal: boolean
  permission: NotificationPermission | 'unsupported'
  hasServiceWorker: boolean
  hasSubscription: boolean
}

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const [loading, setLoading] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [permissionState, setPermissionState] = useState<string>('default')
  const [diagnostics, setDiagnostics] = useState<DiagnosticState>({
    isHttpsOrLocal: true,
    permission: 'default',
    hasServiceWorker: false,
    hasSubscription: false,
  })
  const [settings, setSettings] = useState<NotificationSettings>({
    attendance_reminders: true,
    expense_reminders: true,
    money_given_reminders: true,
    money_received_reminders: true,
  })

  const runDiagnostics = async () => {
    const isHttpsOrLocal =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    const perm = 'Notification' in window ? Notification.permission : 'unsupported'
    setPermissionState(perm)

    let hasSW = false
    let hasSub = false

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        hasSW = true
        const sub = await reg.pushManager.getSubscription()
        hasSub = Boolean(sub)
      }
    }

    setDiagnostics({
      isHttpsOrLocal,
      permission: perm,
      hasServiceWorker: hasSW,
      hasSubscription: hasSub,
    })
  }

  useEffect(() => {
    if (isOpen) {
      runDiagnostics()
      getNotificationSettings().then(setSettings)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleEnablePush = async () => {
    setLoading(true)
    try {
      await requestAndSubscribePush()
      await runDiagnostics()
      showToast.success('Push notifications enabled successfully! 🔔')
    } catch (err: any) {
      showToast.error(err.message || 'Could not enable push notifications.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTestPush = async () => {
    setTestingPush(true)
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers are not supported.')
      }

      const reg = await navigator.serviceWorker.ready
      if (!reg || !reg.showNotification) {
        throw new Error('Service Worker is not ready.')
      }

      await reg.showNotification('🧪 Test Push Notification 🔔', {
        body: 'Web Push API is working on your device! Notifications will arrive when browser is closed.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        data: { url: '/reminders' },
      } as any)

      showToast.success('Test notification dispatched to your system tray! Check your device notifications.')
    } catch (err: any) {
      showToast.error(err.message || 'Failed to dispatch test notification.')
    } finally {
      setTestingPush(false)
    }
  }

  const handleToggleSetting = async (key: keyof NotificationSettings) => {
    const newVal = !settings[key]
    const updated = await updateNotificationSettings({ [key]: newVal })
    setSettings(updated)
    showToast.success('Notification preference updated')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-950/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white leading-tight">
                Push Notification Settings
              </h2>
              <p className="text-xs text-surface-500">Phone alerts & system diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Permission Card */}
          <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-indigo-500" />
                <span className="text-xs font-bold text-surface-900 dark:text-white">
                  Phone Push Status
                </span>
              </div>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase',
                  permissionState === 'granted'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : permissionState === 'denied'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                )}
              >
                {permissionState === 'granted'
                  ? 'ENABLED ✓'
                  : permissionState === 'denied'
                  ? 'BLOCKED ❌'
                  : 'NOT SET'}
              </span>
            </div>

            {permissionState !== 'granted' ? (
              <button
                onClick={handleEnablePush}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Bell size={15} />
                <span>{loading ? 'Subscribing...' : '🔔 Enable Phone Push Notifications'}</span>
              </button>
            ) : (
              <button
                onClick={handleSendTestPush}
                disabled={testingPush}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Send size={15} />
                <span>{testingPush ? 'Dispatching...' : '🧪 Send Test Push Notification Now'}</span>
              </button>
            )}
          </div>

          {/* 5-Point System Diagnostics */}
          <div className="p-4 rounded-2xl bg-surface-50/50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-700/60 space-y-2">
            <h4 className="text-xs font-bold text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-indigo-500" />
              <span>5-Point Setup Verification</span>
            </h4>

            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-surface-500">1. Context (HTTPS / Localhost)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {diagnostics.isHttpsOrLocal ? 'Valid ✅' : 'Invalid (Requires HTTPS) ❌'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">2. Browser Permission</span>
                <span
                  className={cn(
                    'font-bold',
                    diagnostics.permission === 'granted'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {diagnostics.permission === 'granted' ? 'Granted ✅' : `${diagnostics.permission} ❌`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">3. Service Worker (/sw.js)</span>
                <span
                  className={cn(
                    'font-bold',
                    diagnostics.hasServiceWorker
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {diagnostics.hasServiceWorker ? 'Registered ✅' : 'Pending Load ⏳'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">4. PushSubscription</span>
                <span
                  className={cn(
                    'font-bold',
                    diagnostics.hasSubscription
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {diagnostics.hasSubscription ? 'Created ✅' : 'Tap Enable Above ⬆'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">5. Edge Function & Cron</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  Ready (send-push) ⚡
                </span>
              </div>
            </div>
          </div>

          {/* Individual Reminder Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Reminder Categories
            </h4>

            {[
              {
                key: 'attendance_reminders',
                title: '🖐️ Attendance Reminders',
                desc: '9:00 PM → 10:20 PM reminders & 10:30 PM ABSENT alert',
              },
              {
                key: 'money_given_reminders',
                title: '🤝 Money Given / Lent Return Alerts',
                desc: 'Alerts when expected return date arrives',
              },
              {
                key: 'money_received_reminders',
                title: '💰 Money Received Repayment Alerts',
                desc: 'Reminders to repay borrowed money',
              },
              {
                key: 'expense_reminders',
                title: '💸 Expense Logging Reminders',
                desc: 'Daily end-of-day spending summary reminder',
              },
            ].map((item) => {
              const key = item.key as keyof NotificationSettings
              const isEnabled = Boolean(settings[key])
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggleSetting(key)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50/50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700/60 cursor-pointer hover:border-indigo-300 transition-all"
                >
                  <div>
                    <p className="text-xs font-bold text-surface-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div
                    className={cn(
                      'w-11 h-6 flex items-center rounded-full p-1 transition-colors',
                      isEnabled ? 'bg-indigo-600 justify-end' : 'bg-surface-300 dark:bg-surface-700 justify-start'
                    )}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
