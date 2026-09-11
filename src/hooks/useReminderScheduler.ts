import { useEffect, useRef } from 'react'
import { reminderService, attendanceService } from '@/services/dbServices'
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

  useEffect(() => {
    // Check for matching reminders every 10 seconds
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

        // 1. Attendance Reminder Schedule Check (9:00 PM, 9:20 PM, 9:40 PM, 10:00 PM, 10:20 PM)
        if (ATTENDANCE_SLOTS.includes(currentHHMM)) {
          const fireId = `att_rem_${todayStr}_${currentHHMM}`

          if (!firedMap[fireId]) {
            firedMap[fireId] = new Date().toISOString()
            setFiredMap(firedMap)

            // Always check Supabase database as source of truth
            const hasAttendance = await attendanceService.hasTodayAttendanceInDb()

            if (!hasAttendance) {
              const settings = await getNotificationSettings()
              if (settings.attendance_reminders) {
                const isFinal = currentHHMM === '22:20'
                triggerAttendanceNotification(
                  isFinal ? '🖐️ Final Attendance Reminder!' : '🖐️ Attendance Reminder',
                  isFinal
                    ? "Today's attendance window closes in 10 minutes (10:30 PM)! Please submit your attendance now."
                    : "Please submit today's hostel attendance! The attendance window is open."
                )
              }
            }
          }
        }

        // 2. Attendance Window Expiration Check (10:30 PM)
        if (currentHHMM === ABSENT_CHECK_SLOT) {
          const absentFireId = `att_absent_${todayStr}`

          if (!firedMap[absentFireId]) {
            firedMap[absentFireId] = new Date().toISOString()
            setFiredMap(firedMap)

            // Always check Supabase database as source of truth
            const hasAttendance = await attendanceService.hasTodayAttendanceInDb()

            if (!hasAttendance) {
              try {
                await attendanceService.markAttendance('absent', 'Attendance window expired at 10:30 PM')
                showToast.error("❌ Attendance Closed: You were automatically marked ABSENT for today.")
              } catch (err: any) {
                console.error('Failed to auto-mark absent at 10:30 PM:', err)
              }
            }
          }
        }

        // 3. User General Reminders Check
        const reminders = await reminderService.getAllReminders()
        const pendingReminders = reminders.filter((r) => !r.completed)

        for (const r of pendingReminders) {
          const isToday = r.reminder_date === todayStr || r.repeat_type === 'daily'
          if (!isToday) continue

          // Compare HH:mm
          if (r.reminder_time === currentHHMM) {
            const fireId = `${r.id}_${todayStr}_${currentHHMM}`

            if (!firedMap[fireId]) {
              // Mark as fired
              firedMap[fireId] = new Date().toISOString()
              setFiredMap(firedMap)

              // Trigger Notification
              triggerDeviceNotification(r)
            }
          }
        }
      } catch (err) {
        console.error('Error in reminder scheduler:', err)
      } finally {
        isCheckingRef.current = false
      }
    }, 10000)

    return () => clearInterval(intervalId)
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
