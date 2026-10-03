import { useEffect, useState, useCallback, useRef } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { EditReminderModal } from '@/components/ui/EditReminderModal'
import { reminderService, notificationService, subscribeToRealtime } from '@/services/dbServices'
import type { Reminder } from '@/types'
import {
  Plus,
  Clock,
  Trash2,
  Pencil,
  Bell,
  BellOff,
  CheckCircle2,
  ShieldCheck,
  Send,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'
import {
  requestAndSubscribePush,
  showPersistentNotification,
  checkNotificationDiagnostics,
  sendTestPushNotification,
  type NotificationDiagnostics,
} from '@/services/pushNotification'

// Load previously fired notification keys from localStorage to prevent duplicate popups across page reloads
const getStoredNotifiedKeys = (): Set<string> => {
  try {
    const raw = localStorage.getItem('notified_reminder_keys')
    if (raw) {
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr : [])
    }
  } catch {
    // Ignore storage errors
  }
  return new Set()
}

const persistNotifiedKey = (key: string) => {
  try {
    const raw = localStorage.getItem('notified_reminder_keys')
    const arr: string[] = raw ? JSON.parse(raw) : []
    if (!arr.includes(key)) {
      arr.push(key)
      // Keep last 300 keys to avoid unlimited growth
      if (arr.length > 300) arr.splice(0, arr.length - 300)
      localStorage.setItem('notified_reminder_keys', JSON.stringify(arr))
    }
  } catch {
    // Ignore storage errors
  }
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')
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
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [isEnablingPush, setIsEnablingPush] = useState(false)
  const [isTestingPush, setIsTestingPush] = useState(false)

  const [isCheckingNotifications, setIsCheckingNotifications] =
    useState(false)

  // Prevent duplicate notifications across reloads & sessions
  const notifiedRemindersRef = useRef<Set<string>>(getStoredNotifiedKeys())

  // ---------------------------------------------------------
  // LOAD REMINDERS
  // ---------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const data = await reminderService.getAllReminders()
      setReminders(data)
    } catch (err) {
      console.error('Failed to load reminders:', err)
      showToast.error('Failed to load reminders')
    }
  }, [])

  // ---------------------------------------------------------
  // CHECK BROWSER NOTIFICATION SUPPORT & DIAGNOSTICS
  // ---------------------------------------------------------

  const refreshDiagnostics = useCallback(async () => {
    const diag = await checkNotificationDiagnostics()
    setDiagnostics(diag)
    if (diag.permission !== 'unsupported') {
      setNotificationPermission(diag.permission)
    }
  }, [])

  useEffect(() => {
    refreshDiagnostics()
  }, [refreshDiagnostics])

  // ---------------------------------------------------------
  // LOAD DATA + REALTIME
  // ---------------------------------------------------------

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeToRealtime(() => {
      loadData()
    })

    return () => unsubscribe()
  }, [loadData])

  // ---------------------------------------------------------
  // ENABLE NOTIFICATIONS & REAL WEB PUSH SUBSCRIPTION
  // ---------------------------------------------------------

  const enableNotifications = async () => {
    setIsEnablingPush(true)
    try {
      if (!('Notification' in window)) {
        showToast.error('Notifications are not supported on this browser.')
        return
      }

      await requestAndSubscribePush()
      await refreshDiagnostics()
      showToast.success('Mobile push notifications enabled & subscribed! 🔔')

      // Send a test notification through the production path
      await sendTestPushNotification()
      await refreshDiagnostics()
    } catch (error: any) {
      console.error('Notification permission/push error:', error)
      showToast.error(error.message || 'Could not enable notifications')
      await refreshDiagnostics()
    } finally {
      setIsEnablingPush(false)
    }
  }

  // ---------------------------------------------------------
  // SEND PERSISTENT NOTIFICATION VIA SERVICE WORKER
  // ---------------------------------------------------------

  const sendBrowserNotification = useCallback(async (
    title: string,
    body: string,
    notificationId: string
  ) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    // Prevent duplicate notifications
    if (notifiedRemindersRef.current.has(notificationId)) {
      return
    }

    notifiedRemindersRef.current.add(notificationId)
    persistNotifiedKey(notificationId)

    // Store in Supabase / offline queue
    notificationService.createNotification(
      'reminder',
      title,
      body,
      new Date().toISOString(),
      notificationId
    ).catch(console.error)

    // Persistent Mobile & Desktop Notification via Service Worker
    await showPersistentNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: notificationId,
      url: '/reminders',
    })
  }, [])

  // ---------------------------------------------------------
  // TEST NOTIFICATION (PROVES REAL PUSH PIPELINE)
  // ---------------------------------------------------------

  const testNotification = async () => {
    if (!('Notification' in window)) {
      showToast.error('Your browser does not support notifications.')
      return
    }

    if (Notification.permission !== 'granted') {
      await enableNotifications()
      return
    }

    setIsTestingPush(true)
    try {
      const res = await sendTestPushNotification()
      await refreshDiagnostics()
      showToast.success(`Test notification sent! (${res.message})`)
    } catch (err: any) {
      showToast.error(err.message || 'Failed to dispatch test notification')
      await refreshDiagnostics()
    } finally {
      setIsTestingPush(false)
    }
  }

  // ---------------------------------------------------------
  // PARSE REMINDER DATE/TIME
  // ---------------------------------------------------------

  const getReminderDate = (reminder: Reminder): Date | null => {
    try {
      if (!reminder.reminder_date || !reminder.reminder_time) {
        return null
      }

      const dateString = String(reminder.reminder_date).slice(0, 10)

      const timeString = String(reminder.reminder_time)
        .slice(0, 8)

      const date = new Date(`${dateString}T${timeString}`)

      if (Number.isNaN(date.getTime())) {
        return null
      }

      return date
    } catch (error) {
      console.error('Invalid reminder date:', error)
      return null
    }
  }

  // ---------------------------------------------------------
  // CHECK IF REMINDER SHOULD FIRE
  // ---------------------------------------------------------

  const shouldTriggerReminder = (reminder: Reminder): boolean => {
    if (reminder.completed) {
      return false
    }

    const reminderDate = getReminderDate(reminder)

    if (!reminderDate) {
      return false
    }

    const now = new Date()

    // Current time rounded to seconds
    const currentTime = now.getTime()

    // Reminder time
    const reminderTime = reminderDate.getTime()

    // Fire if reminder is due within the last 60 seconds
    // or exactly now.
    const difference = currentTime - reminderTime

    if (difference < 0) {
      return false
    }

    if (difference > 60 * 1000) {
      // For repeating reminders, we handle them separately below.
      if (reminder.repeat_type === 'once') {
        return false
      }
    }

    // -------------------------------------------------------
    // ONCE
    // -------------------------------------------------------

    if (reminder.repeat_type === 'once') {
      return difference >= 0 && difference <= 60 * 1000
    }

    // -------------------------------------------------------
    // DAILY
    // -------------------------------------------------------

    if (reminder.repeat_type === 'daily') {
      const sameHour = now.getHours() === reminderDate.getHours()
      const sameMinute = now.getMinutes() === reminderDate.getMinutes()

      return sameHour && sameMinute
    }

    // -------------------------------------------------------
    // WEEKLY
    // -------------------------------------------------------

    if (reminder.repeat_type === 'weekly') {
      const sameDay = now.getDay() === reminderDate.getDay()
      const sameHour = now.getHours() === reminderDate.getHours()
      const sameMinute = now.getMinutes() === reminderDate.getMinutes()

      return sameDay && sameHour && sameMinute
    }

    // -------------------------------------------------------
    // MONTHLY
    // -------------------------------------------------------

    if (reminder.repeat_type === 'monthly') {
      const sameDate = now.getDate() === reminderDate.getDate()
      const sameHour = now.getHours() === reminderDate.getHours()
      const sameMinute = now.getMinutes() === reminderDate.getMinutes()

      return sameDate && sameHour && sameMinute
    }

    return false
  }

  // ---------------------------------------------------------
  // CREATE UNIQUE NOTIFICATION KEY
  // ---------------------------------------------------------

  const getNotificationKey = (reminder: Reminder): string => {
    const now = new Date()

    if (reminder.repeat_type === 'once') {
      return `reminder-${reminder.id}`
    }

    if (reminder.repeat_type === 'daily') {
      return `reminder-${reminder.id}-${now.toISOString().slice(0, 10)}`
    }

    if (reminder.repeat_type === 'weekly') {
      const year = now.getFullYear()
      const week = Math.floor(
        (Number(
          `${now.getFullYear()}${String(
            Math.ceil(
              ((now.getTime() -
                new Date(now.getFullYear(), 0, 1).getTime()) /
                86400000 +
                new Date(now.getFullYear(), 0, 1).getDay() +
                1) /
              7
            )
          ).padStart(2, '0')}`
        ))
      )

      return `reminder-${reminder.id}-${year}-week-${week}`
    }

    if (reminder.repeat_type === 'monthly') {
      return `reminder-${reminder.id}-${now.getFullYear()}-${now.getMonth() + 1}`
    }

    return `reminder-${reminder.id}-${Date.now()}`
  }

  // ---------------------------------------------------------
  // CHECK REMINDERS
  // ---------------------------------------------------------

  const checkReminders = useCallback(() => {
    if (Notification.permission !== 'granted') {
      return
    }

    setIsCheckingNotifications(true)

    try {
      reminders.forEach((reminder) => {
        if (!shouldTriggerReminder(reminder)) {
          return
        }

        const notificationKey = getNotificationKey(reminder)

        if (notifiedRemindersRef.current.has(notificationKey)) {
          return
        }

        let emoji = '🔔'

        if (reminder.priority === 'high') {
          emoji = '🚨'
        }

        if (reminder.priority === 'medium') {
          emoji = '⏰'
        }

        sendBrowserNotification(
          `${emoji} ${reminder.title}`,
          reminder.description ||
          `Your ${reminder.repeat_type} reminder is due now.`,
          notificationKey
        )

        showToast.success(`Reminder: ${reminder.title}`)
      })
    } finally {
      setIsCheckingNotifications(false)
    }
  }, [reminders])

  // ---------------------------------------------------------
  // RUN NOTIFICATION CHECK EVERY 10 SECONDS
  // ---------------------------------------------------------

  useEffect(() => {
    if (notificationPermission !== 'granted') {
      return
    }

    // Check immediately
    checkReminders()

    // Then check every 10 seconds
    const interval = window.setInterval(() => {
      checkReminders()
    }, 10_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [notificationPermission, checkReminders])

  // ---------------------------------------------------------
  // CHECK MISSED REMINDERS (OFFLINE / VISIBILITY / RECONNECT)
  // ---------------------------------------------------------

  const checkMissedReminders = useCallback(() => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const now = new Date()
    const currentTime = now.getTime()

    reminders.forEach((reminder) => {
      if (reminder.completed) return

      const reminderDate = getReminderDate(reminder)
      if (!reminderDate) return

      const reminderTime = reminderDate.getTime()

      // ONCE reminder
      if (reminder.repeat_type === 'once') {
        // Reminder has not passed yet
        if (currentTime < reminderTime) return

        const notificationKey = `missed-${reminder.id}-${reminderDate
          .toISOString()
          .slice(0, 10)}`

        // Already shown
        if (notifiedRemindersRef.current.has(notificationKey)) {
          return
        }

        sendBrowserNotification(
          `⏰ Missed Reminder: ${reminder.title}`,
          reminder.description ||
            'This reminder was missed while you were offline or away.',
          notificationKey
        )

        showToast.success(`Missed reminder: ${reminder.title}`)
      } else {
        // REPEATING REMINDERS (daily, weekly, monthly)
        let isMissed = false

        if (reminder.repeat_type === 'daily') {
          const scheduledToday = new Date()
          scheduledToday.setHours(reminderDate.getHours(), reminderDate.getMinutes(), 0, 0)
          if (currentTime >= scheduledToday.getTime()) {
            isMissed = true
          }
        } else if (reminder.repeat_type === 'weekly') {
          if (now.getDay() === reminderDate.getDay()) {
            const scheduledThisWeek = new Date()
            scheduledThisWeek.setHours(reminderDate.getHours(), reminderDate.getMinutes(), 0, 0)
            if (currentTime >= scheduledThisWeek.getTime()) {
              isMissed = true
            }
          }
        } else if (reminder.repeat_type === 'monthly') {
          if (now.getDate() === reminderDate.getDate()) {
            const scheduledThisMonth = new Date()
            scheduledThisMonth.setHours(reminderDate.getHours(), reminderDate.getMinutes(), 0, 0)
            if (currentTime >= scheduledThisMonth.getTime()) {
              isMissed = true
            }
          }
        }

        if (isMissed) {
          const notificationKey = `missed-${reminder.id}-${now.toISOString().slice(0, 10)}`
          if (!notifiedRemindersRef.current.has(notificationKey)) {
            sendBrowserNotification(
              `⏰ Missed Reminder: ${reminder.title}`,
              reminder.description ||
                `Your ${reminder.repeat_type} reminder was scheduled for earlier today.`,
              notificationKey
            )
            showToast.success(`Missed reminder: ${reminder.title}`)
          }
        }
      }
    })
  }, [reminders, sendBrowserNotification])

  // ---------------------------------------------------------
  // HANDLE INTERNET RECONNECT & OFFLINE QUEUE SYNC
  // ---------------------------------------------------------

  useEffect(() => {
    const handleOnline = async () => {
      console.log('Internet connection restored')

      // Sync offline-queued notifications to Supabase
      try {
        await notificationService.syncOfflineNotifications()
      } catch (err) {
        console.error('Failed to sync offline notifications:', err)
      }

      // Reload latest reminders from Supabase
      await loadData()

      // Give database request a moment to complete
      setTimeout(() => {
        checkMissedReminders()
      }, 1000)
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [loadData, checkMissedReminders])

  // ---------------------------------------------------------
  // CHECK WHEN PAGE BECOMES VISIBLE AGAIN
  // ---------------------------------------------------------

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkMissedReminders()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkMissedReminders])

  // Check missed reminders when reminders list loads
  useEffect(() => {
    if (notificationPermission === 'granted' && reminders.length > 0) {
      checkMissedReminders()
    }
  }, [notificationPermission, reminders.length, checkMissedReminders])

  // ---------------------------------------------------------
  // TOGGLE REMINDER
  // ---------------------------------------------------------

  const handleToggle = async (id: string, currentVal: boolean) => {
    const newVal = !currentVal

    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, completed: newVal } : r
      )
    )

    try {
      await reminderService.toggleReminder(id, newVal)

      if (newVal) {
        showToast.success('Reminder completed')
      }
    } catch (error) {
      console.error(error)

      // Revert UI
      setReminders((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, completed: currentVal } : r
        )
      )

      showToast.error('Failed to update reminder')
    }
  }

  // ---------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------

  const handleDelete = async (id: string) => {
    try {
      await reminderService.deleteReminder(id)

      setReminders((prev) =>
        prev.filter((r) => r.id !== id)
      )

      // Remove possible notification keys
      for (const key of notifiedRemindersRef.current) {
        if (key.includes(id)) {
          notifiedRemindersRef.current.delete(key)
        }
      }

      showToast.success('Reminder deleted')
    } catch (error) {
      console.error(error)
      showToast.error('Failed to delete reminder')
    }
  }

  // ---------------------------------------------------------
  // NOTIFICATION STATUS
  // ---------------------------------------------------------

  const notificationEnabled =
    notificationPermission === 'granted'

  const notificationBlocked =
    notificationPermission === 'denied'

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Reminders & Notifications</span>
              <span>🔔</span>
            </h1>

            <p className="text-xs text-surface-500">
              Study alerts, hostel reminders & daily tasks
            </p>
          </div>

          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Reminder</span>
          </button>
        </div>

        {/* NOTIFICATION CONTROL & PRODUCTION DIAGNOSTICS */}
        <div
          className={cn(
            'rounded-3xl border p-5 shadow-sm space-y-4',
            notificationEnabled
              ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60'
              : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60'
          )}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'p-3 rounded-2xl shrink-0',
                  notificationEnabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                )}
              >
                {notificationEnabled ? <Bell size={20} /> : <BellOff size={20} />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-surface-900 dark:text-white">
                    {notificationEnabled
                      ? 'Mobile & Web Push Notifications Active'
                      : notificationBlocked
                      ? 'Notifications Blocked'
                      : 'Notifications are Disabled'}
                  </p>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-black uppercase',
                      notificationEnabled
                        ? 'bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : notificationBlocked
                        ? 'bg-rose-200/80 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                        : 'bg-amber-200/80 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    )}
                  >
                    {notificationEnabled ? '🟢 GRANTED' : notificationBlocked ? '🔴 BLOCKED' : '🟡 NOT SET'}
                  </span>
                </div>

                <p className="text-xs text-surface-500 mt-1">
                  {notificationEnabled
                    ? 'Service Worker and Push Subscription are ready. Reminders can alert you on your phone.'
                    : notificationBlocked
                    ? 'Allow notifications in your browser/device site settings to receive reminders.'
                    : 'Enable notifications to receive timely hostel attendance alerts and study reminders on mobile.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!notificationEnabled && !notificationBlocked && (
                <button
                  onClick={enableNotifications}
                  disabled={isEnablingPush}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Bell size={15} />
                  <span>{isEnablingPush ? 'Subscribing...' : 'Enable Notifications'}</span>
                </button>
              )}

              {notificationEnabled && (
                <button
                  onClick={testNotification}
                  disabled={isTestingPush}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Sends test push notification through production path"
                >
                  <Send size={14} />
                  <span>{isTestingPush ? 'Sending Test...' : 'Send Test Notification'}</span>
                </button>
              )}

              <button
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-white/[0.08] text-surface-700 dark:text-surface-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700"
                title="View notification diagnostics"
              >
                <ShieldCheck size={15} className="text-indigo-500" />
                <span>Diagnostics</span>
                {showDiagnostics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {/* Expandable Production Diagnostics Card */}
          {showDiagnostics && (
            <div className="p-4 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/[0.08] space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-surface-800 dark:text-surface-200">
                    Production Notification Diagnostics
                  </h4>
                </div>
                <button
                  onClick={refreshDiagnostics}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Notification Support:</span>
                  <span className="font-bold">
                    {diagnostics.isSupported ? '✅ Supported' : '❌ Unsupported'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Secure Context:</span>
                  <span className="font-bold">
                    {diagnostics.isSecureContext ? '✅ HTTPS' : '❌ Not HTTPS'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Permission:</span>
                  <span className="font-bold">
                    {diagnostics.permission === 'granted'
                      ? '🟢 Granted'
                      : diagnostics.permission === 'denied'
                      ? '🔴 Denied'
                      : '🟡 Not requested'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Service Worker:</span>
                  <span className="font-bold">
                    {diagnostics.hasServiceWorker ? '🟢 Registered' : '🔴 Not registered'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Push:</span>
                  <span className="font-bold">
                    {diagnostics.isSubscribed ? '🟢 Subscribed' : '🟡 Not subscribed'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-surface-500">Subscription:</span>
                  <span className="font-bold">
                    {diagnostics.endpoint ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5 sm:col-span-2">
                  <span className="text-surface-500">Last Notification:</span>
                  <span className="font-semibold text-surface-800 dark:text-surface-200">
                    {diagnostics.lastNotificationTime
                      ? new Date(diagnostics.lastNotificationTime).toLocaleString()
                      : 'None yet'}
                  </span>
                </div>

                {diagnostics.lastPushError && (
                  <div className="sm:col-span-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Last Push Error: {diagnostics.lastPushError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* REMINDER LIST */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-3">

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-900 dark:text-white">
              Your Reminders
            </h2>

            {isCheckingNotifications && (
              <span className="text-[10px] text-surface-400">
                Checking...
              </span>
            )}
          </div>

          {reminders.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs">
              No reminders set. Tap "+ Add Reminder" above!
            </div>
          ) : (
            <div className="space-y-2">

              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={cn(
                    'flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                    reminder.completed
                      ? 'bg-surface-50 dark:bg-surface-950/40 border-surface-200/50 dark:border-surface-800/50 opacity-60'
                      : 'bg-surface-50/50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60'
                  )}
                >

                  <div className="flex items-center gap-3">

                    <input
                      type="checkbox"
                      checked={reminder.completed}
                      onChange={() =>
                        handleToggle(
                          reminder.id,
                          reminder.completed
                        )
                      }
                      className="h-5 w-5 rounded-lg text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div>

                      <p
                        className={cn(
                          'text-sm font-bold text-surface-900 dark:text-white',
                          reminder.completed &&
                          'line-through text-surface-400'
                        )}
                      >
                        {reminder.title}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-surface-500">

                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {reminder.reminder_time}
                        </span>

                        <span>
                          • {reminder.repeat_type}
                        </span>

                        {reminder.priority === 'high' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            HIGH
                          </span>
                        )}

                      </div>

                    </div>
                  </div>

                  <div className="flex items-center gap-1">

                    {reminder.completed && (
                      <CheckCircle2
                        size={16}
                        className="text-emerald-500 mr-1"
                      />
                    )}

                    <button
                      onClick={() =>
                        setEditingReminder(reminder)
                      }
                      className="p-2 rounded-xl text-surface-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      title="Edit Reminder"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(reminder.id)
                      }
                      className="p-2 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Reminder"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>
      </div>

      {/* ADD REMINDER */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab="reminder"
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />

      {/* EDIT REMINDER */}
      <EditReminderModal
        reminder={editingReminder}
        isOpen={Boolean(editingReminder)}
        onClose={() => setEditingReminder(null)}
        onSuccess={loadData}
      />

    </AppLayout>
  )
}