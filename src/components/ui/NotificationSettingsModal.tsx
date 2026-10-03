import { useState, useEffect } from 'react'
import { Bell, X, Smartphone, ShieldCheck, Send, RefreshCw, AlertCircle } from 'lucide-react'
import {
  requestAndSubscribePush,
  getNotificationSettings,
  updateNotificationSettings,
  checkNotificationDiagnostics,
  sendTestPushNotification,
  type NotificationSettings,
  type NotificationDiagnostics,
} from '@/services/pushNotification'
import { showToast } from './Toast'
import { cn } from '@/utils/cn'

interface NotificationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const [loading, setLoading] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics>({
    isSupported: true,
    isSecureContext: true,
    permission: 'default',
    hasServiceWorker: false,
    hasPushManager: false,
    isSubscribed: false,
    endpoint: null,
    lastNotificationTime: null,
    lastPushError: null,
  })
  const [settings, setSettings] = useState<NotificationSettings>({
    attendance_reminders: true,
    expense_reminders: true,
    money_given_reminders: true,
    money_received_reminders: true,
  })

  const runDiagnostics = async () => {
    const diag = await checkNotificationDiagnostics()
    setDiagnostics(diag)
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
      showToast.success('Push notifications enabled & subscribed! 🔔')
    } catch (err: any) {
      showToast.error(err.message || 'Could not enable push notifications.')
      await runDiagnostics()
    } finally {
      setLoading(false)
    }
  }

  const handleSendTestPush = async () => {
    setTestingPush(true)
    try {
      const res = await sendTestPushNotification()
      await runDiagnostics()
      showToast.success(`Test notification sent! (${res.message})`)
    } catch (err: any) {
      showToast.error(err.message || 'Failed to dispatch test notification.')
      await runDiagnostics()
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

  const isGranted = diagnostics.permission === 'granted'
  const isDenied = diagnostics.permission === 'denied'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-950/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white leading-tight">
                Push Notification Settings
              </h2>
              <p className="text-xs text-surface-500">Production diagnostics & mobile alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Permission & Action Card */}
          <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-indigo-500" />
                <span className="text-xs font-bold text-surface-900 dark:text-white">
                  Mobile Push Status
                </span>
              </div>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase',
                  isGranted
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : isDenied
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                )}
              >
                {isGranted ? '🟢 GRANTED' : isDenied ? '🔴 DENIED' : '🟡 NOT REQUESTED'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {!isGranted ? (
                <button
                  onClick={handleEnablePush}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Bell size={15} />
                  <span>{loading ? 'Subscribing...' : '🔔 Enable Notifications'}</span>
                </button>
              ) : (
                <button
                  onClick={handleSendTestPush}
                  disabled={testingPush}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{testingPush ? 'Sending Test...' : '🧪 Send Test Notification'}</span>
                </button>
              )}

              <button
                onClick={runDiagnostics}
                className="py-2.5 px-3 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Refresh system diagnostics"
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Production Diagnostics Section */}
          <div className="p-4 rounded-2xl bg-surface-50/50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-surface-700 dark:text-surface-200 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-indigo-500" />
                <span>Production Notification Diagnostics</span>
              </h4>
              <span className="text-[10px] text-surface-400">Mobile &amp; HTTPS</span>
            </div>

            <div className="space-y-1.5 text-xs divide-y divide-surface-100 dark:divide-surface-700/40">
              <div className="flex items-center justify-between pt-1">
                <span className="text-surface-500">Notification Support:</span>
                <span className="font-bold">
                  {diagnostics.isSupported ? '✅ Supported' : '❌ Unsupported'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Secure Context:</span>
                <span className="font-bold">
                  {diagnostics.isSecureContext ? '✅ HTTPS' : '❌ Not HTTPS'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Permission:</span>
                <span className="font-bold">
                  {isGranted ? '🟢 Granted' : isDenied ? '🔴 Denied' : '🟡 Not requested'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Service Worker:</span>
                <span className="font-bold">
                  {diagnostics.hasServiceWorker ? '🟢 Registered' : '🔴 Not registered'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Push:</span>
                <span className="font-bold">
                  {diagnostics.isSubscribed ? '🟢 Subscribed' : '🟡 Not subscribed'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Subscription:</span>
                <span className="font-bold">
                  {diagnostics.endpoint ? 'Connected' : 'Not connected'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5">
                <span className="text-surface-500">Last Notification:</span>
                <span className="font-semibold text-surface-700 dark:text-surface-300">
                  {diagnostics.lastNotificationTime
                    ? new Date(diagnostics.lastNotificationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'None yet'}
                </span>
              </div>

              {diagnostics.lastPushError && (
                <div className="pt-1.5 text-[11px] text-rose-500 flex items-start gap-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>Last Error: {diagnostics.lastPushError}</span>
                </div>
              )}
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
                desc: '9:00 PM → 10:00 PM reminders (every 10 mins) & 10:00 PM ABSENT alert',
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
