import { supabase } from './supabase'

export interface NotificationSettings {
  user_id?: string
  attendance_reminders: boolean
  expense_reminders: boolean
  money_given_reminders: boolean
  money_received_reminders: boolean
}

export interface NotificationDiagnostics {
  isSupported: boolean
  isSecureContext: boolean
  permission: NotificationPermission | 'unsupported'
  hasServiceWorker: boolean
  hasPushManager: boolean
  isSubscribed: boolean
  endpoint: string | null
  lastNotificationTime: string | null
  lastPushError: string | null
}

const DEFAULT_VAPID_PUBLIC_KEY =
  'BLbxBDkvPm4jFbfAF5IXVPjByFVax9Y4-7C8bHXRdyBM9GtTKmxEuk0GDkaXINgTd7aVPLk_d6-S9uAfpTN9VAA'

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

/**
 * Diagnostic utility to check Notification, Secure Context, Service Worker, and Push status.
 */
export async function checkNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  const isSecureContext = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false
  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window

  let hasServiceWorker = false
  let isSubscribed = false
  let endpoint: string | null = null

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      if (reg) {
        hasServiceWorker = true
        if (hasPushManager) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            isSubscribed = true
            endpoint = sub.endpoint
          }
        }
      }
    } catch (e) {
      console.warn('Diagnostics serviceWorker check failed:', e)
    }
  }

  const lastNotificationTime = typeof localStorage !== 'undefined' ? localStorage.getItem('ht_last_notification_time') : null
  const lastPushError = typeof localStorage !== 'undefined' ? localStorage.getItem('ht_last_push_error') : null

  return {
    isSupported,
    isSecureContext,
    permission,
    hasServiceWorker,
    hasPushManager,
    isSubscribed,
    endpoint,
    lastNotificationTime,
    lastPushError,
  }
}

/**
 * Request notification permission, register service worker, and subscribe to Web Push.
 */
export async function requestAndSubscribePush(): Promise<PushSubscription> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    const errorMsg = 'Push notifications are not supported on this browser/device.'
    localStorage.setItem('ht_last_push_error', errorMsg)
    throw new Error(errorMsg)
  }

  if (!window.isSecureContext) {
    const errorMsg = 'Notifications require a Secure Context (HTTPS or localhost). Current connection is insecure.'
    localStorage.setItem('ht_last_push_error', errorMsg)
    throw new Error(errorMsg)
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    const errorMsg = 'Notification permission was denied. Please allow notifications in browser settings.'
    localStorage.setItem('ht_last_push_error', errorMsg)
    throw new Error(errorMsg)
  }

  try {
    // 2. Ensure Service Worker is registered and active
    let registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    }
    await navigator.serviceWorker.ready

    if (!('pushManager' in registration)) {
      throw new Error('PushManager is not available on this browser.')
    }

    // 3. Prepare VAPID key
    const vapidKeyStr = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
    const applicationServerKey = urlBase64ToUint8Array(vapidKeyStr)

    // 4. Subscribe to Push Manager
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      })
    }

    const rawSub = subscription.toJSON()
    const endpoint = subscription.endpoint
    const p256dh = rawSub.keys?.p256dh || ''
    const auth = rawSub.keys?.auth || ''

    // 5. Store Push Subscription in Supabase with RLS
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userData.user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        )
      }
    } catch (dbErr) {
      console.warn('Could not save push subscription to Supabase push_subscriptions table:', dbErr)
    }

    // Backup to localStorage
    localStorage.setItem('ht_push_subscribed', 'true')
    localStorage.setItem('ht_push_endpoint', endpoint)
    localStorage.removeItem('ht_last_push_error')

    return subscription
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to complete push subscription.'
    localStorage.setItem('ht_last_push_error', errorMsg)
    throw new Error(errorMsg)
  }
}

/**
 * Display a persistent notification via Service Worker (mobile-safe; NEVER calls new Notification on mobile).
 */
export async function showPersistentNotification(
  title: string,
  options: {
    body?: string
    icon?: string
    badge?: string
    tag?: string
    url?: string
    data?: any
    vibrate?: number[]
  } = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  const notificationOptions = {
    body: options.body || 'You have a reminder from Hostel Life Tracker',
    icon: options.icon || '/icons/icon-192.png',
    badge: options.badge || '/icons/icon-192.png',
    tag: options.tag || `reminder-${Date.now()}`,
    vibrate: options.vibrate || [200, 100, 200],
    data: {
      url: options.url || '/reminders',
      ...options.data,
    },
  }

  // 1. Primary: Use ServiceWorkerRegistration.showNotification() (required on mobile!)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notificationOptions as any)
        localStorage.setItem('ht_last_notification_time', new Date().toISOString())
        return true
      }
    } catch (swErr) {
      console.warn('Service worker showNotification error:', swErr)
    }
  }

  // 2. Desktop-only fallback if service worker is not active
  try {
    const notif = new Notification(title, {
      body: notificationOptions.body,
      icon: notificationOptions.icon,
      tag: notificationOptions.tag,
    })
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
    localStorage.setItem('ht_last_notification_time', new Date().toISOString())
    return true
  } catch (notifErr) {
    console.warn('Desktop Notification fallback failed (expected on mobile):', notifErr)
    return false
  }
}

/**
 * Send a test notification through the real production path:
 * Client -> Supabase Edge Function 'send-push' -> Web Push -> Service Worker.
 * Falls back to Service Worker showNotification if Edge Function is offline.
 */
export async function sendTestPushNotification(): Promise<{
  method: 'server_push' | 'service_worker'
  message: string
}> {
  const { isSubscribed, permission } = await checkNotificationDiagnostics()

  if (permission !== 'granted') {
    throw new Error('Notification permission is not granted. Please enable notifications first.')
  }

  // 1. Try real server-side Web Push via Supabase Edge Function 'send-push'
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user && isSubscribed) {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          user_id: userData.user.id,
          title: '🧪 Real Web Push Test 🔔',
          body: 'Success! Web Push delivered through Service Worker even when browser is closed.',
          url: '/reminders',
          tag: `test-push-${Date.now()}`,
        },
      })

      if (!error && data?.success) {
        localStorage.setItem('ht_last_notification_time', new Date().toISOString())
        return {
          method: 'server_push',
          message: 'Real Web Push dispatched via backend push server to your device!',
        }
      }
    }
  } catch (pushErr) {
    console.warn('Edge Function send-push not reached or error, falling back to Service Worker dispatch:', pushErr)
  }

  // 2. Service Worker fallback (demonstrates service worker persistent notification)
  const showed = await showPersistentNotification('🧪 Service Worker Test 🔔', {
    body: 'ServiceWorkerRegistration.showNotification() is working! Notifications will appear on mobile.',
    url: '/reminders',
    tag: `test-sw-${Date.now()}`,
  })

  if (!showed) {
    throw new Error('Could not display test notification via Service Worker.')
  }

  return {
    method: 'service_worker',
    message: 'Test notification displayed directly via Service Worker! (Service worker is active & working)',
  }
}

/**
 * User notification settings management
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const defaultSettings: NotificationSettings = {
    attendance_reminders: true,
    expense_reminders: true,
    money_given_reminders: true,
    money_received_reminders: true,
  }

  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
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
    // Fallback to local storage
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
    if (userData?.user) {
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
