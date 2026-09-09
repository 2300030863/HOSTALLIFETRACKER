import { supabase } from './supabase'

export interface NotificationSettings {
  user_id?: string
  attendance_reminders: boolean
  expense_reminders: boolean
  money_given_reminders: boolean
  money_received_reminders: boolean
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function requestAndSubscribePush(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Push notifications are not supported in this browser.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.')
  }

  const registration = await navigator.serviceWorker.ready
  const vapidPublicKey =
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    'BLbxBDkvPm4jFbfAF5IXVPjByFVax9Y4-7C8bHXRdyBM9GtTKmxEuk0GDkaXINgTd7aVPLk_d6-S9uAfpTN9VAA'

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey.buffer as ArrayBuffer,
    })
  }

  const rawSub = subscription.toJSON()
  const endpoint = subscription.endpoint
  const p256dh = rawSub.keys?.p256dh || ''
  const auth = rawSub.keys?.auth || ''

  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: userData.user.id,
          endpoint,
          p256dh,
          auth,
        },
        { onConflict: 'user_id,endpoint' }
      )
    }
  } catch (err) {
    console.warn('Saved subscription locally (Supabase offline or demo mode)')
  }

  // Backup to localStorage
  localStorage.setItem('ht_push_subscribed', 'true')
  localStorage.setItem('ht_push_endpoint', endpoint)

  return true
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const defaultSettings: NotificationSettings = {
    attendance_reminders: true,
    expense_reminders: true,
    money_given_reminders: true,
    money_received_reminders: true,
  }

  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (!error && data) {
        return data as NotificationSettings
      }
    }
  } catch {
    // Fallback
  }

  const saved = localStorage.getItem('ht_notification_settings')
  return saved ? JSON.parse(saved) : defaultSettings
}

export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const current = await getNotificationSettings()
  const updated = { ...current, ...settings }

  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await supabase.from('notification_settings').upsert({
        user_id: userData.user.id,
        ...updated,
        updated_at: new Date().toISOString(),
      })
    }
  } catch {
    // Fallback
  }

  localStorage.setItem('ht_notification_settings', JSON.stringify(updated))
  return updated
}
