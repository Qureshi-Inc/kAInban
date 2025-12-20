import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Shield, Settings } from 'lucide-react'
import { useState } from 'react'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'

export default function UserProfile({ collapsed = false }) {
  const user = useAppStore(state => state.user)
  const logout = useAppStore(state => state.logout)
  const setSettingsOpen = useAppStore(state => state.setSettingsOpen)
  const [isOpen, setIsOpen] = useState(false)

  if (!user) {
    return null
  }

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout()
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${collapsed ? 'w-10 h-10 p-0 justify-center' : ''}`}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm border-2 border-black">
            {user.name?.charAt(0).toUpperCase() ||
              user.email?.charAt(0).toUpperCase()}
          </div>
        </div>
        {!collapsed && (
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
            />

            {/* Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: collapsed ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: collapsed ? 10 : -10 }}
              transition={{ duration: 0.15 }}
              className={`${
                collapsed
                  ? 'absolute left-full bottom-0 ml-2'
                  : 'fixed sm:absolute left-1 sm:left-auto sm:right-0 bottom-20 sm:bottom-auto sm:top-full sm:mt-2'
              } w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-[9999]`}
            >
              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg border-2 border-black">
                    {user.name?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                {user.role === 'admin' && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                    <Shield className="h-3 w-3" />
                    <span className="font-medium">Administrator</span>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setSettingsOpen(true)
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
