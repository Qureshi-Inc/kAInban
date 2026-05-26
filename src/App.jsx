import { motion } from 'framer-motion'
import React, { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'

// Components
import ActivityPanel from './components/ActivityPanel'
import AuthPage from './components/AuthPage'
import DebugPanel from './components/DebugPanel'
import Header from './components/Header'
import InviteRegistrationForm from './components/InviteRegistrationForm'
import LeftSidebar from './components/LeftSidebar'
import NotificationSystem from './components/NotificationSystem'
import ProgressIndicator from './components/ProgressIndicator'
import RecordingModal from './components/RecordingModal'
import SettingsDialog from './components/SettingsDialog'

// Pages
import MainView from './pages/MainView'
import openaiService from './services/openaiService'
import useAppStore from './stores/useAppStore'

// Inner App component that handles authenticated routes
function AuthenticatedApp() {
  const [loading, setLoading] = React.useState(true)
  const [activityPanelOpen, setActivityPanelOpen] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const user = useAppStore(state => state.user)
  const authChecked = useAppStore(state => state.authChecked)
  const checkAuth = useAppStore(state => state.checkAuth)
  const setUser = useAppStore(state => state.setUser)
  const notifications = useAppStore(state => state.notifications)
  const uploadProgress = useAppStore(state => state.uploadProgress)
  const resetUploadProgress = useAppStore(state => state.resetUploadProgress)
  const initialize = useAppStore(state => state.initialize)
  const currentProject = useAppStore(state => state.currentProject)
  const provider = useAppStore(state => state.settings.provider)
  const azureEndpoint = useAppStore(state => state.settings.azureEndpoint)
  const openaiBaseUrl = useAppStore(state => state.settings.openaiBaseUrl)
  const keyConfigured = useAppStore(state => state.settings.keyConfigured)
  const apiVersion = useAppStore(state => state.settings.apiVersion)
  const whisperDeployment = useAppStore(
    state => state.settings.whisperDeployment
  )
  const gptDeployment = useAppStore(state => state.settings.gptDeployment)
  const openaiWhisperModel = useAppStore(
    state => state.settings.openaiWhisperModel
  )
  const openaiGptModel = useAppStore(state => state.settings.openaiGptModel)

  useEffect(() => {
    // Check authentication and initialize in parallel
    const initApp = async () => {
      try {
        // Check authentication first
        const authenticatedUser = await checkAuth()

        if (!authenticatedUser) {
          setLoading(false)
          return
        }

        // Extract URL context for initialization
        const urlParams = new URLSearchParams(window.location.search)
        const urlContext = {
          projectId: urlParams.get('project'),
          meetingId: urlParams.get('meeting'),
          tenant: urlParams.get('tenant')
        }

        // Initialize from backend with URL context
        const result = await initialize(urlContext)
        if (result === undefined) {
          // Settings load failed, will use defaults
        }

        setLoading(false)
      } catch (error) {
        console.error('[App] Initialization failed:', error)
        // Don't show error screen, just stop loading and show login
        setLoading(false)
      }
    }

    initApp()

    return () => {}
  }, [])

  useEffect(() => {
    // Only configure OpenAI service if user is authenticated
    if (!user) {
      return
    }

    try {
      // Configure OpenAI service with current settings
      openaiService.configure({
        provider,
        azureEndpoint,
        openaiBaseUrl,
        keyConfigured,
        apiVersion,
        whisperDeployment,
        gptDeployment,
        openaiWhisperModel,
        openaiGptModel
      })
    } catch (error) {
      console.error('[App] Error configuring OpenAI service:', error)
    }
  }, [
    user,
    provider,
    azureEndpoint,
    openaiBaseUrl,
    keyConfigured,
    apiVersion,
    whisperDeployment,
    gptDeployment,
    openaiWhisperModel,
    openaiGptModel
  ])

  // Show auth page if not authenticated (even while checking)
  if (!user) {
    // Show modern loading screen on first mount
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
          <div className="text-center p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Modern logo animation */}
              <div className="relative">
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center text-white text-3xl shadow-2xl mx-auto"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  🎤
                </motion.div>

                {/* Pulse rings */}
                <motion.div
                  className="absolute inset-0 w-20 h-20 rounded-2xl border-2 border-primary/30 mx-auto"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              </div>

              {/* Loading text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  kAInban
                </h2>
                <motion.p
                  className="text-muted-foreground"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Initializing your workspace...
                </motion.p>
              </div>

              {/* Loading bar */}
              <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mx-auto">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary"
                  animate={{ x: [-192, 192] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      )
    }
    return (
      <AuthPage
        onAuthSuccess={authenticatedUser => {
          setUser(authenticatedUser)
          setLoading(true)

          // Extract URL context for post-login initialization
          const urlParams = new URLSearchParams(window.location.search)
          const urlContext = {
            projectId: urlParams.get('project'),
            meetingId: urlParams.get('meeting'),
            tenant: urlParams.get('tenant')
          }

          // Re-initialize app after login with URL context
          initialize(urlContext)
            .then(() => {
              setLoading(false)
            })
            .catch(error => {
              console.error('[App] Post-login initialization error:', error)
              setLoading(false)
            })
        }}
      />
    )
  }

  // Show loading while initializing after login
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Skeleton loading for workspace */}
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl mx-auto animate-pulse" />
              <div className="space-y-2">
                <div className="h-6 w-32 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-4 w-48 bg-muted/60 animate-pulse rounded mx-auto" />
              </div>
            </div>

            {/* Workspace skeleton */}
            <div className="w-80 max-w-full space-y-3">
              <div className="h-12 bg-muted animate-pulse rounded-lg" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-20 bg-muted/60 animate-pulse rounded" />
                <div className="h-20 bg-muted/60 animate-pulse rounded" />
                <div className="h-20 bg-muted/60 animate-pulse rounded" />
              </div>
            </div>

            <motion.p
              className="text-sm text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Setting up your workspace...
            </motion.p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Left Sidebar - Overlay when open */}
      <LeftSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area - full width */}
      <div className="flex flex-col min-h-screen">
        {/* Header with hamburger menu and activity button */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50">
          <div className="w-full px-6 py-4">
            <Header
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onShowActivity={() => setActivityPanelOpen(true)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="space-y-8 max-w-[1920px] mx-auto"
          >
            <Routes>
              <Route path="/" element={<MainView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="text-center px-6">
            <p className="text-sm text-muted-foreground">
              Built with <span className="text-red-500">♥</span> by{' '}
              <span className="font-medium text-foreground">
                InterestingSoup
              </span>{' '}
              <span className="text-xs opacity-70">2025</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Activity Panel */}
      <ActivityPanel
        isOpen={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
      />

      {/* Modals and overlays */}
      <SettingsDialog />
      <RecordingModal />
      <NotificationSystem notifications={notifications} />

      {/* Progress indicator for file uploads */}
      <ProgressIndicator
        progress={{
          ...uploadProgress,
          onDismiss: resetUploadProgress
        }}
      />

      {/* Debug panel for mobile development */}
      {import.meta.env.DEV && <DebugPanel />}
    </div>
  )
}

// Main App router component
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public invite registration route */}
        <Route path="/invite/:token" element={<InviteRegistrationForm />} />

        {/* All other routes go through authenticated app */}
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
