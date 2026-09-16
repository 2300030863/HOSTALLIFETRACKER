import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, CheckCheck, X, WifiOff, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { notificationService } from '@/services/dbServices'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { AppNotification } from '@/types'

interface NotificationCenterProps {
  className?: string
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showMissedBanner, setShowMissedBanner] = useState(false)
  const [missedCount, setMissedCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const isOnline = useOnlineStatus()
  const wasOfflineRef = useRef(false)

  // Track offline→online transitions for the missed banner
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      // Small delay to let sync complete
      const timer = setTimeout(async () => {
        const count = await notificationService.getUnreadCount()
        if (count > 0) {
          setMissedCount(count)
          setShowMissedBanner(true)
          // Auto-dismiss after 15 seconds
          setTimeout(() => setShowMissedBanner(false), 15000)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  // Fetch notifications periodically when online
  const fetchNotifications = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const [all, count] = await Promise.all([
        notificationService.getAllNotifications(50),
        notificationService.getUnreadCount(),
      ])
      setNotifications(all)
      setUnreadCount(count)
    } catch (e) {
      console.error('Failed to fetch notifications:', e)
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    fetchNotifications()
    const pollInterval = setInterval(fetchNotifications, 30000) // Poll every 30s
    return () => clearInterval(pollInterval)
  }, [fetchNotifications])

  // Refresh when coming online
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(fetchNotifications, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, fetchNotifications])

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleToggle = async () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen) {
      setLoading(true)
      await fetchNotifications()
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleDismissBanner = () => {
    setShowMissedBanner(false)
  }

  const handleViewFromBanner = () => {
    setShowMissedBanner(false)
    setIsOpen(true)
    fetchNotifications()
  }

  // Group notifications by date
  const grouped = groupByDate(notifications)

  return (
    <>
      {/* Missed Notifications Banner (offline → online transition) */}
      {showMissedBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md animate-slide-down">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl shadow-2xl shadow-amber-500/30 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff size={18} />
                <span className="font-bold text-sm">You were offline</span>
              </div>
              <button
                onClick={handleDismissBanner}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-white/90">
              You have <span className="font-bold">{missedCount}</span> missed notification{missedCount > 1 ? 's' : ''}.
            </p>
            <button
              onClick={handleViewFromBanner}
              className="self-start mt-1 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors backdrop-blur-sm"
            >
              View Notifications
            </button>
          </div>
        </div>
      )}

      {/* Notification Bell Button + Dropdown */}
      <div ref={panelRef} className={cn('relative', className)}>
        {/* Bell Button */}
        <button
          onClick={handleToggle}
          className="relative flex h-9.5 w-9.5 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 dark:text-surface-300 transition-all cursor-pointer border-0 outline-none"
          title="Notifications"
          id="notification-center-bell"
        >
          <Bell size={18} />
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[10px] font-bold text-white px-1 shadow-lg shadow-rose-500/40 animate-scale-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/80 dark:border-surface-800/80 shadow-2xl shadow-surface-900/10 dark:shadow-black/30 z-50 flex flex-col animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-800 shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary-500" />
                <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 text-[11px] font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-3">
                    <Bell size={24} className="text-surface-400" />
                  </div>
                  <p className="text-sm font-semibold text-surface-500 dark:text-surface-400">
                    No notifications 🎉
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {grouped.map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      {/* Date Group Header */}
                      <div className="px-4 py-2 sticky top-0 bg-surface-50/95 dark:bg-surface-950/95 backdrop-blur-sm">
                        <span className="text-[11px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                          {dateLabel}
                        </span>
                      </div>

                      {/* Notification Items */}
                      {items.map((notif) => (
                        <NotificationItem
                          key={notif.id}
                          notification={notif}
                          onMarkRead={handleMarkAsRead}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="px-4 py-2 border-t border-surface-100 dark:border-surface-800 bg-amber-50/50 dark:bg-amber-950/20 shrink-0">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <WifiOff size={14} />
                  <span className="text-[11px] font-semibold">
                    You're offline — notifications will sync when you reconnect
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Individual Notification Item ──
function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: AppNotification
  onMarkRead: (id: string) => void
}) {
  const isUnread = !notification.read
  const time = formatTime(notification.scheduled_at)
  const typeIcon = getTypeIcon(notification.type)
  const typeBorderColor = getTypeBorderColor(notification.type)

  return (
    <button
      onClick={() => isUnread && onMarkRead(notification.id)}
      className={cn(
        'w-full text-left px-4 py-3 flex gap-3 transition-all border-l-3',
        isUnread
          ? `${typeBorderColor} bg-primary-50/40 dark:bg-primary-950/20 hover:bg-primary-50/70 dark:hover:bg-primary-950/30`
          : 'border-transparent hover:bg-surface-50 dark:hover:bg-surface-800/50',
        'cursor-pointer'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl text-sm',
          isUnread
            ? 'bg-primary-100 dark:bg-primary-900/50'
            : 'bg-surface-100 dark:bg-surface-800'
        )}
      >
        {typeIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs truncate',
              isUnread
                ? 'font-bold text-surface-900 dark:text-white'
                : 'font-medium text-surface-500 dark:text-surface-400'
            )}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={10} className="text-surface-400" />
            <span className="text-[10px] text-surface-400 dark:text-surface-500 font-medium whitespace-nowrap">
              {time}
            </span>
          </div>
        </div>
        <p
          className={cn(
            'text-[11px] mt-0.5 leading-relaxed line-clamp-2',
            isUnread
              ? 'text-surface-600 dark:text-surface-300'
              : 'text-surface-400 dark:text-surface-500'
          )}
        >
          {notification.message}
        </p>
      </div>

      {/* Read indicator */}
      {isUnread && (
        <div className="shrink-0 mt-1">
          <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse-soft" />
        </div>
      )}
      {!isUnread && (
        <div className="shrink-0 mt-1 text-surface-300 dark:text-surface-600">
          <Check size={14} />
        </div>
      )}
    </button>
  )
}

// ── Helpers ──

function getTypeIcon(type: string): string {
  switch (type) {
    case 'attendance':
      return '🖐️'
    case 'reminder':
      return '🔔'
    case 'system':
      return '⚙️'
    default:
      return '📌'
  }
}

function getTypeBorderColor(type: string): string {
  switch (type) {
    case 'attendance':
      return 'border-amber-500'
    case 'reminder':
      return 'border-primary-500'
    case 'system':
      return 'border-emerald-500'
    default:
      return 'border-surface-300'
  }
}

function formatTime(isoStr: string): string {
  try {
    const date = new Date(isoStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

function groupByDate(notifications: AppNotification[]): [string, AppNotification[]][] {
  const groups: Record<string, AppNotification[]> = {}
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  for (const notif of notifications) {
    const dateStr = notif.scheduled_at.split('T')[0]
    let label: string
    if (dateStr === today) {
      label = 'Today'
    } else if (dateStr === yesterday) {
      label = 'Yesterday'
    } else {
      try {
        label = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      } catch {
        label = dateStr
      }
    }

    if (!groups[label]) groups[label] = []
    groups[label].push(notif)
  }

  return Object.entries(groups)
}
