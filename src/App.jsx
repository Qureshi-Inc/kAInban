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
  const [loadError, setLoadError] = React.useState(null)
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
  }, [azureEndpoint, apiKey, apiVersion, whisperDeployment, gptDeployment])

  console.log('[App] Rendering...')

  // Show auth page if not authenticated (even while checking)
  if (!user) {
    // Show minimal loading only on first mount
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-2xl mb-4">Loading...</div>
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-2xl mb-4">Loading your workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full px-6 py-6 max-w-[1920px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <Header />

          {/* Show Analytics Dashboard when no project is selected */}
          {!currentProject ? (
            <AnalyticsDashboard />
          ) : (
            <>
              <AudioControls />

              <div className="space-y-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-8">
                    <SummaryPanel />
                  </div>

                  <div className="xl:col-span-4">
                    <MeetingFilesPanel />
                  </div>
                </div>

                <KanbanBoard />
              </div>
            </>
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
    </div>
  )
}

export default App