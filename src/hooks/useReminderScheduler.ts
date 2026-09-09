import { useEffect, useRef } from 'react'
import { reminderService } from '@/services/dbServices'
import { showToast } from '@/components/ui/Toast'
import type { Reminder } from '@/types'

// Key for tracking fired reminders today to avoid duplicate notifications
const FIRED_KEY = 'ht_fired_reminders'

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

        const reminders = await reminderService.getAllReminders()
        const pendingReminders = reminders.filter((r) => !r.completed)

        const firedMap = getFiredMap()

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
