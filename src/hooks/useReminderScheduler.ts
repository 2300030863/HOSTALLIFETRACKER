import { useEffect, useRef } from 'react'
import { reminderService, attendanceService, notificationService, getTodayStr } from '@/services/dbServices'
import { getNotificationSettings } from '@/services/pushNotification'
import { showToast } from '@/components/ui/Toast'
import type { Reminder } from '@/types'

// Key for tracking fired reminders today to avoid duplicate notifications
const FIRED_KEY = 'ht_fired_reminders'

const ABSENT_CHECK_SLOT = '22:30'

function getFiredMap(): Record<string, string> {
  try {
    const data = localStorage.getItem(FIRED_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function setFiredMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map))
  } catch (e) {
    console.error(e)
  }
}

export function useReminderScheduler() {
  const isCheckingRef = useRef(false)
  const onlineSyncDoneRef = useRef(false)

  useEffect(() => {
    // ── Online reconnection handler ──
    const handleOnline = async () => {
      if (onlineSyncDoneRef.current) return
      onlineSyncDoneRef.current = true

      try {
        const syncedCount = await notificationService.syncOfflineNotifications()
        if (syncedCount > 0) {
          const unreadCount = await notificationService.getUnreadCount()
          if (unreadCount > 0) {
            showToast.warning(
              `🔔 You were offline — you have ${unreadCount} missed notification${unreadCount > 1 ? 's' : ''}. Tap the bell to view.`
            )
          }
        }

        // Clean up old read notifications (30-day retention)
        await notificationService.cleanOldNotifications()
      } catch (e) {
        console.error('Failed to sync offline notifications:', e)
      }

      setTimeout(() => {
        onlineSyncDoneRef.current = false
      }, 5000)
    }

    window.addEventListener('online', handleOnline)

    if (navigator.onLine) {
      handleOnline()
    }

    // ── Main scheduler interval (every 10 seconds) ──
    const intervalId = setInterval(async () => {
      if (isCheckingRef.current) return
      isCheckingRef.current = true

      try {
        const now = new Date()
        const todayStr = getTodayStr(now)
        const currentHour = now.getHours()
        const currentMin = now.getMinutes()
        const totalMinutes = currentHour * 60 + currentMin
        const currentHHMM = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`

        const firedMap = getFiredMap()

        // ─── 1. Attendance Reminder Schedule Check (9:00 PM to 10:30 PM) ───
        // Active between 21:00 (9:00 PM) and 22:30 (10:30 PM)
        if (totalMinutes >= 21 * 60 && totalMinutes < 22 * 60 + 30) {
          const slotMin = Math.floor(currentMin / 20) * 20
          const slotHHMM = `${String(currentHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`
          const fireId = `att_rem_${todayStr}_${slotHHMM}`

          if (!firedMap[fireId]) {
            let hasAttendance: boolean | null = null
            try {
              hasAttendance = await attendanceService.hasTodayAttendanceInDb()
            } catch {
              console.warn(`[Attendance] DB check failed for slot ${slotHHMM}, will retry`)
            }

            if (hasAttendance === true) {
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)
            } else if (hasAttendance === false) {
              const settings = await getNotificationSettings()
              if (settings.attendance_reminders) {
                const isFinal = slotHHMM === '22:20' || totalMinutes >= 22 * 60 + 15
                const title = isFinal ? '🖐️ Final Attendance Reminder!' : '🖐️ Attendance Reminder'
                const message = isFinal
                  ? "Today's attendance window closes in 10 minutes (10:30 PM)! Please submit your attendance now."
                  : "Please submit today's hostel attendance! The attendance window is open."

                const notificationKey = `attendance-${todayStr}-${slotHHMM}`

                await notificationService.createNotification(
                  'attendance',
                  title,
                  message,
                  now.toISOString(),
                  notificationKey
                )

                if (navigator.onLine) {
                  triggerAttendanceNotification(title, message)
                }
              }
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)
            }
          }
        }

        // ─── 2. Attendance Window Expiration Check (10:30 PM) ───
        if (currentHHMM >= ABSENT_CHECK_SLOT && totalMinutes < 23 * 60 + 59) {
          const absentFireId = `att_absent_${todayStr}`

          if (!firedMap[absentFireId]) {
            let hasAttendance: boolean | null = null
            try {
              hasAttendance = await attendanceService.hasTodayAttendanceInDb()
            } catch {
              console.warn('[Attendance] DB check failed for absent-marking, will retry')
            }

            if (hasAttendance === true) {
              firedMap[absentFireId] = new Date().toISOString()
              setFiredMap(firedMap)
            } else if (hasAttendance === false) {
              try {
                await attendanceService.markAttendance('absent', 'Attendance window expired at 10:30 PM')
                showToast.error("❌ Attendance Closed: You were automatically marked ABSENT for today.")

                await notificationService.createNotification(
                  'attendance',
                  '❌ Marked Absent',
                  'You were automatically marked ABSENT because attendance was not submitted before 10:30 PM.',
                  now.toISOString(),
                  `attendance-absent-${todayStr}`
                )

                firedMap[absentFireId] = new Date().toISOString()
                setFiredMap(firedMap)
              } catch (err: any) {
                console.error('Failed to auto-mark absent at 10:30 PM:', err)
              }
            }
          }
        }

        // ─── 3. User General Reminders Check (Supports Overdue Catch-up) ───
        const reminders = await reminderService.getAllReminders()
        const pendingReminders = reminders.filter((r) => !r.completed)

        for (const r of pendingReminders) {
          const isToday = r.reminder_date === todayStr || r.repeat_type === 'daily'
          if (!isToday) continue

          // Trigger if reminder time has arrived or passed today
          if (r.reminder_time <= currentHHMM) {
            const fireId = `reminder_${r.id}_${todayStr}`

            if (!firedMap[fireId]) {
              const title = `🔔 Reminder: ${r.title}`
              const message = r.description || `It's ${r.reminder_time}! Priority: ${r.priority.toUpperCase()}`
              const notificationKey = `reminder-${r.id}-${todayStr}-${r.reminder_time}`

              await notificationService.createNotification(
                'reminder',
                title,
                message,
                now.toISOString(),
                notificationKey
              )

              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)

              if (navigator.onLine) {
                triggerDeviceNotification(r)
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in reminder scheduler:', err)
      } finally {
        isCheckingRef.current = false
      }
    }, 10000)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('online', handleOnline)
    }
  }, [])
}

async function triggerAttendanceNotification(title: string, body: string) {
  // 1. In-App Toast
  showToast.warning(`${title} — ${body}`)

  // 2. Audio Chime
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.play().catch(() => {})
  } catch {
    // Audio play fallback
  }

  // 3. Native Device / Browser Push Notification
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          if (registration && registration.showNotification) {
            await registration.showNotification(title, {
              body,
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              vibrate: [200, 100, 200],
              data: { url: '/' },
            } as any)
            return
          }
        }

        new Notification(title, { body, icon: '/favicon.svg' })
      } catch (e) {
        console.warn('Service worker notification failed, falling back to standard Notification:', e)
        try {
          new Notification(title, { body, icon: '/favicon.svg' })
        } catch {}
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }
}

async function triggerDeviceNotification(reminder: Reminder) {
  const title = `🔔 Reminder: ${reminder.title}`
  const body = reminder.description || `It's ${reminder.reminder_time}! Priority: ${reminder.priority.toUpperCase()}`

  // 1. In-App Toast
  showToast.warning(`${title} — ${body}`)

  // 2. Audio Chime
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.play().catch(() => {})
  } catch {
    // Audio play fallback
  }

  // 3. Native Device / Browser Push Notification
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          if (registration && registration.showNotification) {
            await registration.showNotification(title, {
              body,
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              vibrate: [200, 100, 200],
              data: { url: '/reminders' },
            } as any)
            return
          }
        }

        new Notification(title, { body, icon: '/favicon.svg' })
      } catch (e) {
        console.warn('Service worker notification failed, falling back to standard Notification:', e)
        try {
          new Notification(title, { body, icon: '/favicon.svg' })
        } catch {}
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }
}
