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

  const getColors = type => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm ${getColors(notification.type)}`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">
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

  return (
    <div className="fixed top-4 right-4 z-[99999999] space-y-2">
      <AnimatePresence>
        {notifications.map(notification => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </AnimatePresence>
    </div>
  )
}
