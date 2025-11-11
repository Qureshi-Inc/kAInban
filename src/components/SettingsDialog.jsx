import React, { useState, useEffect } from 'react'
import { Settings, User, Bot } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import useAppStore from '../stores/useAppStore'
import apiService from '../services/apiService'

export default function SettingsDialog() {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const addNotification = useAppStore((state) => state.addNotification)
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)

  const [aiFormData, setAiFormData] = useState({
    azureEndpoint: '',
    apiKey: '',
    apiVersion: '2024-02-01',
    whisperDeployment: 'whisper-1',
    gptDeployment: 'gpt-4'
  })

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [testingConnection, setTestingConnection] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Sync form data when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setAiFormData({
        azureEndpoint: settings.azureEndpoint || '',
        apiKey: settings.apiKey || '',
        apiVersion: settings.apiVersion || '2024-02-01',
        whisperDeployment: settings.whisperDeployment || 'whisper-1',
        gptDeployment: settings.gptDeployment || 'gpt-4'
      })
      setUserFormData({
        name: user?.name || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    }
  }, [isSettingsOpen, settings, user])

  const handleTestConnection = async () => {
    console.log('[Settings] Testing Azure OpenAI connection...')
    setTestingConnection(true)

    if (!aiFormData.azureEndpoint || !aiFormData.apiKey) {
      addNotification({
        type: 'error',
        message: 'Please fill in endpoint and API key first'
      })
      setTestingConnection(false)
      return
    }

    try {
      const testUrl = `${aiFormData.azureEndpoint}/openai/models?api-version=${aiFormData.apiVersion}`
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'api-key': aiFormData.apiKey
        }
      })

      if (response.ok) {
        addNotification({
          type: 'success',
          message: 'API connection successful! ✓'
        })
      } else {
        addNotification({
          type: 'error',
          message: `API Error: ${response.status} ${response.statusText}`
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Connection failed: ${error.message}`
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSaveAiSettings = () => {
    if (!aiFormData.azureEndpoint || !aiFormData.apiKey) {
      addNotification({
        type: 'error',
        message: 'Please fill in all required fields'
      })
      return
    }

    try {
      new URL(aiFormData.azureEndpoint)
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Please enter a valid Azure OpenAI endpoint URL'
      })
      return
    }

    updateSettings(aiFormData)
    setSettingsOpen(false)

    addNotification({
      type: 'success',
      message: 'AI settings saved successfully!'
    })
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)

    try {
      // Validate passwords if changing
      if (userFormData.newPassword) {
        if (userFormData.newPassword !== userFormData.confirmPassword) {
          addNotification({
            type: 'error',
            message: 'New passwords do not match'
          })
          setSavingProfile(false)
          return
        }
        if (!userFormData.currentPassword) {
          addNotification({
            type: 'error',
            message: 'Current password is required to change password'
          })
          setSavingProfile(false)
          return
        }
      }

      // TODO: Add API endpoint to update user profile
      // For now, just update name and email
      const updatedUser = {
        ...user,
        name: userFormData.name,
        email: userFormData.email
      }

      setUser(updatedUser)
      setSettingsOpen(false)

      addNotification({
        type: 'success',
        message: 'Profile updated successfully!'
      })
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to update profile: ${error.message}`
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAiInputChange = (field, value) => {
    setAiFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUserInputChange = (field, value) => {
    setUserFormData(prev => ({ ...prev, [field]: value }))
  }

  const isAdmin = user?.role === 'admin'

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">
              <User className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="ai">
                <Bot className="h-4 w-4 mr-2" />
                AI Settings
              </TabsTrigger>
            )}
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={userFormData.name}
                onChange={(e) => handleUserInputChange('name', e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={userFormData.email}
                onChange={(e) => handleUserInputChange('email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Change Password</h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    value={userFormData.currentPassword}
                    onChange={(e) => handleUserInputChange('currentPassword', e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={userFormData.newPassword}
                    onChange={(e) => handleUserInputChange('newPassword', e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    value={userFormData.confirmPassword}
                    onChange={(e) => handleUserInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Leave blank to keep current password
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          {/* AI Settings Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="ai" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Azure OpenAI Endpoint *
                </label>
                <Input
                  type="url"
                  placeholder="https://your-resource.openai.azure.com"
                  value={aiFormData.azureEndpoint}
                  onChange={(e) => handleAiInputChange('azureEndpoint', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  API Key *
                </label>
                <Input
                  type="password"
                  placeholder="Your Azure OpenAI API Key"
                  value={aiFormData.apiKey}
                  onChange={(e) => handleAiInputChange('apiKey', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    API Version
                  </label>
                  <Input
                    value={aiFormData.apiVersion}
                    onChange={(e) => handleAiInputChange('apiVersion', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Whisper Deployment
                  </label>
                  <Input
                    value={aiFormData.whisperDeployment}
                    onChange={(e) => handleAiInputChange('whisperDeployment', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  GPT Deployment
                </label>
                <Input
                  value={aiFormData.gptDeployment}
                  onChange={(e) => handleAiInputChange('gptDeployment', e.target.value)}
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
                  <Button onClick={handleSaveAiSettings}>
                    Save AI Settings
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                * Required fields. Use "Test Connection" to verify your Azure OpenAI setup.
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}