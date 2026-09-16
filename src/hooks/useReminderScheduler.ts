import { useEffect, useRef } from 'react'
import { reminderService, attendanceService, notificationService } from '@/services/dbServices'
import { getNotificationSettings } from '@/services/pushNotification'
import { showToast } from '@/components/ui/Toast'
import type { Reminder } from '@/types'

// Key for tracking fired reminders today to avoid duplicate notifications
const FIRED_KEY = 'ht_fired_reminders'

const ATTENDANCE_SLOTS = ['21:00', '21:20', '21:40', '22:00', '22:20']
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
    // When the user comes back online, sync offline-queued notifications
    // and show a "missed notifications" banner.
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

        // Also clean up old read notifications (30-day retention)
        await notificationService.cleanOldNotifications()
      } catch (e) {
        console.error('Failed to sync offline notifications:', e)
      }

      // Reset so the next offline→online transition triggers sync again
      setTimeout(() => {
        onlineSyncDoneRef.current = false
      }, 5000)
    }

    window.addEventListener('online', handleOnline)

    // If we're already online on mount, run initial sync (catches app restart after offline)
    if (navigator.onLine) {
      handleOnline()
    }

    // ── Main scheduler interval (every 10 seconds) ──
    const intervalId = setInterval(async () => {
      if (isCheckingRef.current) return
      isCheckingRef.current = true

      try {
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`

        const firedMap = getFiredMap()

        // ─── 1. Attendance Reminder Schedule Check ───
        // Slots: 9:00 PM, 9:20 PM, 9:40 PM, 10:00 PM, 10:20 PM
        if (ATTENDANCE_SLOTS.includes(currentHHMM)) {
          const fireId = `att_rem_${todayStr}_${currentHHMM}`

          if (!firedMap[fireId]) {
            // Check Supabase database as the single source of truth.
            // Do NOT mark slot as fired until we get a definitive answer,
            // so transient network/DB failures allow retry on the next cycle.
            let hasAttendance: boolean | null = null
            try {
              hasAttendance = await attendanceService.hasTodayAttendanceInDb()
            } catch {
              // DB unreachable — skip this cycle so we retry in 10s
              console.warn(`[Attendance] DB check failed for slot ${currentHHMM}, will retry`)
            }

            // hasAttendance is null if DB was unreachable → skip entirely, retry next cycle
            if (hasAttendance === true) {
              // DB confirmed attendance exists → mark slot fired, no notification
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)
            } else if (hasAttendance === false) {
              // No attendance record → send reminder + record notification
              const settings = await getNotificationSettings()
              if (settings.attendance_reminders) {
                const isFinal = currentHHMM === '22:20'
                const title = isFinal ? '🖐️ Final Attendance Reminder!' : '🖐️ Attendance Reminder'
                const message = isFinal
                  ? "Today's attendance window closes in 10 minutes (10:30 PM)! Please submit your attendance now."
                  : "Please submit today's hostel attendance! The attendance window is open."

                const notificationKey = `attendance-${todayStr}-${currentHHMM}`

                // Record the notification (Supabase or offline queue)
                await notificationService.createNotification(
                  'attendance',
                  title,
                  message,
                  now.toISOString(),
                  notificationKey
                )

                // Show browser/toast notification only if online
                if (navigator.onLine) {
                  triggerAttendanceNotification(title, message)
                }
              }
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)
            }
            // else hasAttendance === null → DB error, don't mark fired, retry next cycle
          }
        }

        // ─── 2. Attendance Window Expiration Check (10:30 PM) ───
        //    Only mark ABSENT if Supabase confirms NO record exists for today.
        if (currentHHMM === ABSENT_CHECK_SLOT) {
          const absentFireId = `att_absent_${todayStr}`

          if (!firedMap[absentFireId]) {
            let hasAttendance: boolean | null = null
            try {
              hasAttendance = await attendanceService.hasTodayAttendanceInDb()
            } catch {
              // DB unreachable — do NOT mark absent on uncertainty, retry next cycle
              console.warn('[Attendance] DB check failed for absent-marking, will retry')
            }

            // hasAttendance is null if DB was unreachable → do NOT mark absent, retry next cycle
            if (hasAttendance === true) {
              // Attendance exists (submitted at e.g. 10:25 PM) → do nothing
              firedMap[absentFireId] = new Date().toISOString()
              setFiredMap(firedMap)
            } else if (hasAttendance === false) {
              // No attendance record confirmed by DB → mark ABSENT
              try {
                await attendanceService.markAttendance('absent', 'Attendance window expired at 10:30 PM')
                showToast.error("❌ Attendance Closed: You were automatically marked ABSENT for today.")

                // Record absence notification
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
                // markAttendance failed — don't mark slot as fired so we retry
                console.error('Failed to auto-mark absent at 10:30 PM:', err)
              }
            }
            // else hasAttendance === null → DB error, don't mark fired or absent, retry next cycle
          }
        }

        // ─── 3. User General Reminders Check ───
        const reminders = await reminderService.getAllReminders()
        const pendingReminders = reminders.filter((r) => !r.completed)

        for (const r of pendingReminders) {
          const isToday = r.reminder_date === todayStr || r.repeat_type === 'daily'
          if (!isToday) continue

          // Compare HH:mm
          if (r.reminder_time === currentHHMM) {
            const fireId = `${r.id}_${todayStr}_${currentHHMM}`

            if (!firedMap[fireId]) {
              const title = `🔔 Reminder: ${r.title}`
              const message = r.description || `It's ${r.reminder_time}! Priority: ${r.priority.toUpperCase()}`
              const notificationKey = `reminder-${r.id}-${todayStr}-${currentHHMM}`

              // Record the notification (Supabase or offline queue)
              await notificationService.createNotification(
                'reminder',
                title,
                message,
                now.toISOString(),
                notificationKey
              )

              // Mark as fired
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)

              // Show browser/toast notification only if online
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
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            vibrate: [200, 100, 200],
            data: { url: '/' },
          } as any)
          return
        }
      }

      // Standard Notification fallback
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      })
    } catch (e) {
      console.error('Failed to dispatch native notification:', e)
    }
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
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
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            vibrate: [200, 100, 200],
            data: { url: '/reminders' },
          } as any)
          return
        }
      }

      // Standard Notification fallback
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      })
    } catch (e) {
      console.error('Failed to dispatch native notification:', e)
    }
  } else if ('Notification' in window && Notification.permission === 'default') {
    // Request permission automatically if reminder triggers
    Notification.requestPermission()
  }
}
