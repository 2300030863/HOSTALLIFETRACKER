// Service Worker for Hostel Life Tracker Mobile & Production Push Notifications
// Scope: /

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Listen for Web Push events from Supabase / Web Push backend
self.addEventListener('push', (event) => {
  let data = {
    title: 'Hostel Life Tracker 🔔',
    body: 'You have a reminder',
    url: '/reminders',
    tag: 'hostel-reminder',
  }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      try {
        data.body = event.data.text()
      } catch {
        // Fallback default
      }
    }
  }

  const title = data.title || 'Hostel Life Tracker 🔔'
  const options = {
    body: data.body || 'You have a reminder',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || `hostel-reminder-${Date.now()}`,
    data: {
      url: data.url || '/reminders',
      reminderId: data.reminderId || null,
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url || '/reminders'
  const targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If an existing window/tab is open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client && client.url !== targetUrl) {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }

        // If no window is open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
