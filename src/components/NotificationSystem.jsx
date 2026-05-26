import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import React from 'react'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'

const NotificationItem = ({ notification }) => {
  const { removeNotification } = useAppStore()

  const getIcon = type => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />
      case 'error':
        return <AlertCircle className="h-5 w-5" />
      case 'info':
      default:
        return <Info className="h-5 w-5" />
    }
  }

  // v3 alert pattern: solid surface (bg-card) + colored left-border strip
  // for the accent. The previous design used bg-{success,destructive,info}/10
  // which is a 10% tint — fine on a blank canvas, but unreadable on mobile
  // where the notification overlaps the header (the project title bleeds
  // through the near-transparent card). DESIGN.md calls for left-border
  // accent strips, not full-color fills.
  const getAccentClasses = type => {
    switch (type) {
      case 'success':
        return 'border-l-success [&_[data-notification-icon]]:text-success'
      case 'error':
        return 'border-l-destructive [&_[data-notification-icon]]:text-destructive'
      case 'info':
      default:
        return 'border-l-info [&_[data-notification-icon]]:text-info'
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-md border border-l-4 shadow-lg w-full sm:w-auto sm:max-w-sm bg-card text-card-foreground ${getAccentClasses(notification.type)}`}
    >
      <div data-notification-icon className="flex-shrink-0 mt-0.5">
        {getIcon(notification.type)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight text-foreground">
          {notification.message}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-6 w-6 hover:bg-black/10"
        onClick={() => removeNotification(notification.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

export default function NotificationSystem({ notifications }) {
  if (!notifications || notifications.length === 0) {
    return null
  }

  // Mobile: push the stack below the header (which wraps at < 640px and can
  // be roughly two rows of h-9 buttons + gap-2 ≈ ~88px). On sm+, keep the
  // standard top-4 offset where the header is a single row and the
  // notification corner is empty.
  return (
    <div
      className="fixed top-20 sm:top-4 right-2 sm:right-4 left-2 sm:left-auto z-[99999999] flex flex-col items-end gap-2 pointer-events-none"
    >
      <AnimatePresence>
        {notifications.map(notification => (
          <div key={notification.id} className="pointer-events-auto w-full sm:w-auto">
            <NotificationItem notification={notification} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
