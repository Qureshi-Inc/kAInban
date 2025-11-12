import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import useAppStore from './stores/useAppStore'
import openaiService from './services/openaiService'

// Components
import Header from './components/Header'
import AudioControls from './components/AudioControls'
import SummaryPanel from './components/SummaryPanel'
import MeetingFilesPanel from './components/MeetingFilesPanel'
import KanbanBoard from './components/KanbanBoard'
import SettingsDialog from './components/SettingsDialog'
import RecordingModal from './components/RecordingModal'
import NotificationSystem from './components/NotificationSystem'
import DebugPanel from './components/DebugPanel'
import ProgressIndicator from './components/ProgressIndicator'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import AuthPage from './components/AuthPage'

function App() {
  const [loading, setLoading] = React.useState(true)
  const user = useAppStore((state) => state.user)
  const authChecked = useAppStore((state) => state.authChecked)
  const checkAuth = useAppStore((state) => state.checkAuth)
  const setUser = useAppStore((state) => state.setUser)
  const notifications = useAppStore((state) => state.notifications)
  const uploadProgress = useAppStore((state) => state.uploadProgress)
  const resetUploadProgress = useAppStore((state) => state.resetUploadProgress)
  const initialize = useAppStore((state) => state.initialize)
  const currentProject = useAppStore((state) => state.currentProject)
  const azureEndpoint = useAppStore((state) => state.settings.azureEndpoint)
  const apiKey = useAppStore((state) => state.settings.apiKey)
  const apiVersion = useAppStore((state) => state.settings.apiVersion)
  const whisperDeployment = useAppStore((state) => state.settings.whisperDeployment)
  const gptDeployment = useAppStore((state) => state.settings.gptDeployment)

  useEffect(() => {
    console.log('[App] Component mounted - checking authentication')
    console.log('[App] Window location:', window.location.href)

    // Check authentication and initialize in parallel
    const initApp = async () => {
      try {
        // Check authentication first
        const authenticatedUser = await checkAuth()
        
        if (!authenticatedUser) {
          console.log('[App] Not authenticated, showing login')
          setLoading(false)
          return
        }

        console.log('[App] Authenticated as:', authenticatedUser.email)

        // Initialize from backend
        const result = await initialize()
        if (result === undefined) {
          console.log('[App] Initialization returned undefined')
        }

        console.log('[App] Backend initialization successful')

        // Check if settings are empty, if so, load from environment variables
        const { settings, updateSettings } = useAppStore.getState()

        console.log('[App] Current database settings:', {
          hasEndpoint: !!settings.azureEndpoint,
          hasApiKey: !!settings.apiKey,
          endpoint: settings.azureEndpoint?.substring(0, 40),
        })

        console.log('[App] Environment variables:', {
          ENDPOINT: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT?.substring(0, 40),
          HAS_KEY: !!import.meta.env.VITE_AZURE_OPENAI_API_KEY,
          VERSION: import.meta.env.VITE_AZURE_OPENAI_API_VERSION,
          WHISPER: import.meta.env.VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT,
          GPT: import.meta.env.VITE_AZURE_OPENAI_GPT_DEPLOYMENT
        })

        if (!settings.azureEndpoint || !settings.apiKey) {
          console.log('[App] No settings in database, loading from .env file')

          const envSettings = {
            azureEndpoint: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT || '',
            apiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY || '',
            apiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01',
            whisperDeployment: import.meta.env.VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper',
            gptDeployment: import.meta.env.VITE_AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4'
          }

          console.log('[App] Loaded from .env:', {
            hasEndpoint: !!envSettings.azureEndpoint,
            hasApiKey: !!envSettings.apiKey,
            whisperDeployment: envSettings.whisperDeployment,
            gptDeployment: envSettings.gptDeployment
          })

          // Update settings with environment variables
          updateSettings(envSettings)
          console.log('[App] Settings updated with .env values')
        } else {
          console.log('[App] Using existing database settings')
        }

        setLoading(false)
      } catch (error) {
        console.error('[App] Initialization failed:', error)
        // Don't show error screen, just stop loading and show login
        setLoading(false)
      }
    }

    initApp()

    return () => console.log('[App] Component unmounting')
  }, [])

  useEffect(() => {
    // Only configure OpenAI service if user is authenticated
    if (!user) {
      return
    }

    try {
      console.log('[App] Configuring OpenAI service')
      // Configure OpenAI service with current settings
      openaiService.configure({
        azureEndpoint,
        apiKey,
        apiVersion,
        whisperDeployment,
        gptDeployment
      })
    } catch (error) {
      console.error('[App] Error configuring OpenAI service:', error)
    }
  }, [user, azureEndpoint, apiKey, apiVersion, whisperDeployment, gptDeployment])

  console.log('[App] Rendering...')

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
                    ease: "easeInOut"
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
                    ease: "easeInOut"
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
                    ease: "easeInOut"
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
        onAuthSuccess={(authenticatedUser) => {
          console.log('[App] Authentication successful:', authenticatedUser.email)
          setUser(authenticatedUser)
          setLoading(true)
          // Re-initialize app after login
          initialize()
            .then(() => {
              console.log('[App] Post-login initialization complete')
              setLoading(false)
            })
            .catch((error) => {
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
      {/* Modern glassmorphism navbar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="w-full px-6 py-4 max-w-[1920px] mx-auto">
          <Header />
        </div>
      </div>

      {/* Main content area */}
      <div className="w-full px-6 py-8 max-w-[1920px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* Show Analytics Dashboard when no project is selected */}
          {!currentProject ? (
            <div className="space-y-6">
              {/* Breadcrumb for context */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="font-medium">Dashboard</span>
                <span className="text-xs">•</span>
                <span>Overview & Analytics</span>
              </motion.div>

              <AnalyticsDashboard />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Project breadcrumb and context */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                {/* Breadcrumb navigation */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className="hover:text-foreground cursor-pointer transition-colors font-medium"
                    onClick={() => {
                      const { clearSession } = useAppStore.getState()
                      clearSession()
                    }}
                  >
                    Dashboard
                  </span>
                  <span className="text-xs">→</span>
                  <span className="font-medium text-foreground">{currentProject.name}</span>
                  <span className="text-xs">•</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                    {currentProject.tasks?.length || 0} tasks
                  </span>
                </div>

              </motion.div>

              {/* Audio controls with modern styling */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <AudioControls />
              </motion.div>

              {/* Content grid with improved spacing */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-8">
                    <SummaryPanel />
                  </div>

                  <div className="xl:col-span-4">
                    <MeetingFilesPanel />
                  </div>
                </div>

                <KanbanBoard />
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>

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

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Built with <span className="text-red-500">♥</span> by{' '}
            <span className="font-medium text-foreground">InterestingSoup</span>{' '}
            <span className="text-xs opacity-70">2025</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App