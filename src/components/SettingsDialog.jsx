import React, { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import useAppStore from '../stores/useAppStore'

export default function SettingsDialog() {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const addNotification = useAppStore((state) => state.addNotification)

  const [formData, setFormData] = useState({
    azureEndpoint: '',
    apiKey: '',
    apiVersion: '2024-02-01',
    whisperDeployment: 'whisper-1',
    gptDeployment: 'gpt-4'
  })

  const [testingConnection, setTestingConnection] = useState(false)

  // Sync form data when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setFormData({
        azureEndpoint: settings.azureEndpoint || '',
        apiKey: settings.apiKey || '',
        apiVersion: settings.apiVersion || '2024-02-01',
        whisperDeployment: settings.whisperDeployment || 'whisper-1',
        gptDeployment: settings.gptDeployment || 'gpt-4'
      })
    }
  }, [isSettingsOpen])

  const handleTestConnection = async () => {
    console.log('[Settings] Testing Azure OpenAI connection...')
    setTestingConnection(true)

    if (!formData.azureEndpoint || !formData.apiKey) {
      addNotification({
        type: 'error',
        message: 'Please fill in endpoint and API key first'
      })
      setTestingConnection(false)
      return
    }

    try {
      // Test with a simple request to list models (lightweight)
      const testUrl = `${formData.azureEndpoint}/openai/models?api-version=${formData.apiVersion}`
      console.log('[Settings] Test URL:', testUrl)

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'api-key': formData.apiKey
        }
      })

      console.log('[Settings] Response status:', response.status)

      if (response.ok) {
        addNotification({
          type: 'success',
          message: 'API connection successful! ✓'
        })
        console.log('[Settings] ✓ Connection successful')
      } else {
        const errorText = await response.text()
        console.error('[Settings] Connection failed:', response.status, errorText)
        addNotification({
          type: 'error',
          message: `API Error: ${response.status} ${response.statusText}`
        })
      }
    } catch (error) {
      console.error('[Settings] Connection error:', error)
      addNotification({
        type: 'error',
        message: `Connection failed: ${error.message}`
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSave = () => {
    if (!formData.azureEndpoint || !formData.apiKey) {
      addNotification({
        type: 'error',
        message: 'Please fill in all required fields'
      })
      return
    }

    try {
      // Validate endpoint format
      new URL(formData.azureEndpoint)
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Please enter a valid Azure OpenAI endpoint URL'
      })
      return
    }

    updateSettings(formData)
    setSettingsOpen(false)

    addNotification({
      type: 'success',
      message: 'Settings saved successfully!'
    })
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Azure OpenAI Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Azure OpenAI Endpoint *
            </label>
            <Input
              type="url"
              placeholder="https://your-resource.openai.azure.com"
              value={formData.azureEndpoint}
              onChange={(e) => handleInputChange('azureEndpoint', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              API Key *
            </label>
            <Input
              type="password"
              placeholder="Your Azure OpenAI API Key"
              value={formData.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                API Version
              </label>
              <Input
                value={formData.apiVersion}
                onChange={(e) => handleInputChange('apiVersion', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Whisper Deployment
              </label>
              <Input
                value={formData.whisperDeployment}
                onChange={(e) => handleInputChange('whisperDeployment', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              GPT Deployment
            </label>
            <Input
              value={formData.gptDeployment}
              onChange={(e) => handleInputChange('gptDeployment', e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Settings
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            * Required fields. Use "Test Connection" to verify your Azure OpenAI setup.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}