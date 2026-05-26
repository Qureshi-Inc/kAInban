import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Settings,
  Search,
  Bell,
  CheckSquare,
  Key
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAppStore from '../stores/useAppStore'
import SearchModal from './SearchModal'
import { Button } from './ui/button'
import UserProfile from './UserProfile'

export default function LeftSidebar({ isOpen, onClose }) {
  const navigate = useNavigate()
  const clearSession = useAppStore((state) => state.clearSession)
  const clearCurrentProject = useAppStore((state) => state.clearCurrentProject)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const addNotification = useAppStore((state) => state.addNotification)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleDashboard = () => {
    clearCurrentProject() // Clear any selected project
    // Preserve tenant parameter when navigating to dashboard
    const currentParams = new URLSearchParams(window.location.search)
    const tenant = currentParams.get('tenant')
    const dashboardUrl = tenant ? `/?tenant=${tenant}` : '/'
    navigate(dashboardUrl)
    onClose() // Close the sidebar after navigation
  }

  const handleComingSoon = (feature) => {
    addNotification({
      type: 'info',
      message: `${feature} - Coming soon!`
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/55 z-40"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col z-50"
          >
            {/* Header with logo */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <img src="/icon-192.png" alt="kAInban" className="w-8 h-8 object-contain" />
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    kAInban
                  </h1>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-4">
              <nav className="space-y-2 px-3">
                {/* Search */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsSearchOpen(true)
                    onClose()
                  }}
                  className="w-full justify-start h-12 px-4"
                >
                  <Search className="h-5 w-5 mr-3" />
                  <span>Search</span>
                </Button>

                {/* Home */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleDashboard()
                    onClose()
                  }}
                  className="w-full justify-start h-12 px-4"
                >
                  <Home className="h-5 w-5 mr-3" />
                  <span>Home</span>
                </Button>

                {/* Notifications */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleComingSoon('Notifications')
                    onClose()
                  }}
                  className="w-full justify-start h-12 px-4 relative"
                >
                  <Bell className="h-5 w-5 mr-3" />
                  <span>Notifications</span>
                  {/* Notification badge - could be dynamic */}
                  {/* <div className="absolute top-2 left-8 w-2 h-2 bg-red-500 rounded-full" /> */}
                </Button>

                {/* Todo List (@mentions) */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleComingSoon('Todo List')
                    onClose()
                  }}
                  className="w-full justify-start h-12 px-4"
                >
                  <CheckSquare className="h-5 w-5 mr-3" />
                  <span>Todo List</span>
                </Button>

                {/* Requests */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleComingSoon('Requests')
                    onClose()
                  }}
                  className="w-full justify-start h-12 px-4"
                >
                  <Key className="h-5 w-5 mr-3" />
                  <span>Requests</span>
                </Button>
              </nav>
            </div>

            {/* Bottom section with settings and user profile */}
            <div className="border-t border-border/50 p-3 space-y-2">
              {/* Settings */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSettingsOpen(true)
                  onClose()
                }}
                className="w-full justify-start h-12 px-4"
              >
                <Settings className="h-5 w-5 mr-3" />
                <span>Settings</span>
              </Button>

              {/* User Profile */}
              <div className="pt-2">
                <UserProfile collapsed={false} />
              </div>
            </div>
          </motion.div>
        </>
      )}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </AnimatePresence>
  )
}