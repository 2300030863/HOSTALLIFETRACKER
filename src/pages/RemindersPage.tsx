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
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'

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
  // CHECK BROWSER NOTIFICATION SUPPORT
  // ---------------------------------------------------------

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    } else {
      setNotificationPermission('denied')
    }
  }, [])

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
  // ENABLE NOTIFICATIONS
  // ---------------------------------------------------------

  const enableNotifications = async () => {
    try {
      if (!('Notification' in window)) {
        showToast.error(
          'This browser does not support desktop notifications.'
        )
        return
      }

      const permission = await Notification.requestPermission()

      setNotificationPermission(permission)

      if (permission === 'granted') {
        showToast.success('Notifications enabled successfully')

        // Immediately send a test notification
        sendBrowserNotification(
          'Hostel Life Tracker',
          '🔔 Notifications are working correctly!',
          'notification-test'
        )
      } else if (permission === 'denied') {
        showToast.error(
          'Notifications are blocked. Allow notifications in browser settings.'
        )
      }
    } catch (error) {
      console.error('Notification permission error:', error)
      showToast.error('Could not enable notifications')
    }
  }

  // ---------------------------------------------------------
  // SEND BROWSER NOTIFICATION
  // ---------------------------------------------------------

  const sendBrowserNotification = useCallback((
    title: string,
    body: string,
    notificationId: string
  ) => {
    if (!('Notification' in window)) {
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

    try {
      const notification = new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: notificationId,
        requireInteraction: false,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (error) {
      console.error('Failed to display notification:', error)
    }
  }, [])

  // ---------------------------------------------------------
  // TEST NOTIFICATION
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

    const testId = `manual-test-${Date.now()}`

    // Remove from duplicate set so every test works
    notifiedRemindersRef.current.delete(testId)

    sendBrowserNotification(
      'Hostel Life Tracker',
      '🔔 Test notification successful! Your reminders can now alert you.',
      testId
    )

    showToast.success('Test notification sent')
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

        {/* NOTIFICATION CONTROL */}
        <div
          className={cn(
            'rounded-3xl border p-5',
            notificationEnabled
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
          )}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'p-3 rounded-2xl',
                  notificationEnabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                )}
              >
                {notificationEnabled ? (
                  <Bell size={20} />
                ) : (
                  <BellOff size={20} />
                )}
              </div>

              <div>
                <p className="font-bold text-sm text-surface-900 dark:text-white">
                  {notificationEnabled
                    ? 'Notifications are enabled'
                    : notificationBlocked
                      ? 'Notifications are blocked'
                      : 'Notifications are disabled'}
                </p>

                <p className="text-xs text-surface-500 mt-1">
                  {notificationEnabled
                    ? 'Your browser can show reminder pop-ups.'
                    : notificationBlocked
                      ? 'Allow notifications in your browser site settings.'
                      : 'Enable notifications to receive reminder pop-ups.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">

              {!notificationEnabled && !notificationBlocked && (
                <button
                  onClick={enableNotifications}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Bell size={15} />
                    Enable Notifications
                  </span>
                </button>
              )}

              {notificationEnabled && (
                <button
                  onClick={testNotification}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  Test Notification
                </button>
              )}

            </div>
          </div>
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