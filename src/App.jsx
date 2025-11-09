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

function App() {
  const [loadError, setLoadError] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const notifications = useAppStore((state) => state.notifications)
  const uploadProgress = useAppStore((state) => state.uploadProgress)
  const resetUploadProgress = useAppStore((state) => state.resetUploadProgress)
  const initialize = useAppStore((state) => state.initialize)
  const azureEndpoint = useAppStore((state) => state.settings.azureEndpoint)
  const apiKey = useAppStore((state) => state.settings.apiKey)
  const apiVersion = useAppStore((state) => state.settings.apiVersion)
  const whisperDeployment = useAppStore((state) => state.settings.whisperDeployment)
  const gptDeployment = useAppStore((state) => state.settings.gptDeployment)

  useEffect(() => {
    console.log('[App] Component mounted - initializing')
    console.log('[App] Window location:', window.location.href)

    // Initialize from backend
    initialize()
      .then(() => {
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
      })
      .catch(error => {
        console.error('[App] Initialization failed:', error)
        setLoadError(error.message || 'Failed to connect to backend')
        setLoading(false)
      })

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-2xl mb-4">Loading...</div>
          <div className="text-sm text-muted-foreground">Connecting to backend</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive rounded-lg p-6">
          <h2 className="text-xl font-bold text-destructive mb-4">Connection Error</h2>
          <p className="text-sm mb-4">{loadError}</p>
          <div className="text-xs bg-black/20 p-3 rounded mb-4 font-mono break-all">
            Trying to connect to: /api/settings
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded"
          >
            Retry
          </button>
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