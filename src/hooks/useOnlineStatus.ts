import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to track browser online/offline status.
 * Returns current online state and provides a callback registry
 * for components to react to connectivity changes.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Standalone (non-hook) helper to check current online status.
 * Safe to call outside of React components (e.g., in services).
 */
export function isCurrentlyOnline(): boolean {
  return navigator.onLine
}

/**
 * Register a one-time callback for the next 'online' event.
 * Useful in services outside React component lifecycle.
 * Returns a cleanup function to remove the listener.
 */
export function onNextOnline(callback: () => void): () => void {
  const handler = () => {
    callback()
    window.removeEventListener('online', handler)
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
