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
import InviteRegistrationForm from './components/InviteRegistrationForm'
import NotificationSystem from './components/NotificationSystem'
import ProgressIndicator from './components/ProgressIndicator'
import RecordingModal from './components/RecordingModal'
import SettingsDialog from './components/SettingsDialog'
import AppShell from './components/shell/AppShell'
import CommandPalette from './components/ui/command-palette'

// Pages
import MainView from './pages/MainView'
import openaiService from './services/openaiService'
import useAppStore from './stores/useAppStore'

// Inner App component that handles authenticated routes
function AuthenticatedApp() {
  const [loading, setLoading] = React.useState(true)
  const [activityPanelOpen, setActivityPanelOpen] = React.useState(false)
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
  const toggleCommandPalette = useAppStore(state => state.toggleCommandPalette)

  // Global Cmd+K / Ctrl+K listener — single source of truth for opening
  // the command palette per DESIGN.md v3.1.7. Lives at App level so every
  // route + every modal share the same shortcut. Skips when an input or
  // contenteditable has focus AND the user is typing a regular char (we
  // still honor the chord even when typing, since it's a global affordance,
  // but we explicitly skip when an `<input>` or `<textarea>` is matching
  // its own browser shortcut by checking event.defaultPrevented).
  useEffect(() => {
    if (!user) return
    const handler = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'k' &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user, toggleCommandPalette])

  useEffect(() => {
    // Check authentication and initialize in parallel
    const initApp = async() => {
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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Logo — solid accent surface, no gradient/rotate animation */}
              <div className="w-16 h-16 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-2xl mx-auto border border-primary">
                🎤
              </div>

              {/* Loading text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-emphasis tracking-tight text-foreground">
                  kAInban
                </h2>
                <motion.p
                  className="text-muted-foreground text-sm"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  Initializing your workspace
                </motion.p>
              </div>

              {/* Loading bar — single accent, no gradient sweep */}
              <div className="w-48 h-px bg-border overflow-hidden mx-auto">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ x: [-192, 192] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: '40%' }}
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Skeleton loading for workspace — flat surface ladder, no gradient */}
            <div className="space-y-4">
              <div className="w-14 h-14 bg-muted rounded-md mx-auto animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-3 w-48 bg-muted animate-pulse rounded mx-auto" />
              </div>
            </div>

            {/* Workspace skeleton */}
            <div className="w-80 max-w-full space-y-2">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 bg-muted animate-pulse rounded" />
                <div className="h-16 bg-muted animate-pulse rounded" />
                <div className="h-16 bg-muted animate-pulse rounded" />
              </div>
            </div>

            <motion.p
              className="text-sm text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              Setting up your workspace
            </motion.p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* v3.1 app shell — sidebar + topbar + canvas + inspector slot.
          Replaces the old Header + LeftSidebar overlay layout. Inspector
          slot stays empty until Slice 3 hooks TaskInspector into it. */}
      <AppShell onShowActivity={() => setActivityPanelOpen(true)}>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 sm:space-y-8 max-w-[1400px] mx-auto px-3 sm:px-6 py-6 sm:py-8"
        >
          <Routes>
            <Route path="/" element={<MainView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>

        {/* Newspaper colophon — keeps the v3 footer signature in the
            scrollable canvas (not the fixed shell chrome). */}
        <footer className="py-6 border-t border-border bg-background">
          <div className="text-center px-6">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-mono">
              kAInban · built by{' '}
              <span className="text-foreground">InterestingSoup</span>{' '}
              · 2026
            </p>
          </div>
        </footer>
      </AppShell>

      {/* Activity Panel — slides in from the right; replaced by Inspector
          in Slice 3 for task-specific activity. Keeps the existing
          workspace-wide activity feed for now. */}
      <ActivityPanel
        isOpen={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
      />

      {/* Modals and overlays — render outside the shell so they portal
          above the sidebar/inspector chrome. */}
      <SettingsDialog />
      <RecordingModal />
      <CommandPalette />
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
    </>
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
