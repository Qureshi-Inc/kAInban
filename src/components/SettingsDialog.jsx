import React, { useState, useEffect } from 'react'
import { Settings, User, Bot, KeyRound, Users } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import useAppStore from '../stores/useAppStore'
import apiService from '../services/apiService'
import UserManagement from './UserManagement'

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
    gptDeployment: 'gpt-4',
    oidcEnabled: false,
    oidcClientId: '',
    oidcClientSecret: '',
    oidcIssuer: 'https://pocketid.app',
    oidcCallbackUrl: ''
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
        gptDeployment: settings.gptDeployment || 'gpt-4',
        oidcEnabled: settings.oidcEnabled || false,
        oidcClientId: settings.oidcClientId || '',
        oidcClientSecret: settings.oidcClientSecret || '',
        oidcIssuer: settings.oidcIssuer || 'https://pocketid.app',
        oidcCallbackUrl: settings.oidcCallbackUrl || ''
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className={`grid w-full gap-1 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'} ${isAdmin ? 'p-1 h-auto min-h-[2.5rem]' : 'h-10'}`}>
            <TabsTrigger value="general" className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">General</span>
              <span className="sm:hidden text-xs">Profile</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="ai" className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]">
                  <Bot className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden lg:inline">AI Settings</span>
                  <span className="lg:hidden text-xs">AI</span>
                </TabsTrigger>
                <TabsTrigger value="auth" className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]">
                  <KeyRound className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden lg:inline">Authentication</span>
                  <span className="lg:hidden text-xs">Auth</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden lg:inline">Users</span>
                  <span className="lg:hidden text-xs">Users</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-4 px-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={userFormData.name}
                  onChange={(e) => handleUserInputChange('name', e.target.value)}
                  placeholder="Your name"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => handleUserInputChange('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full"
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-sm font-semibold mb-4">Change Password</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    value={userFormData.currentPassword}
                    onChange={(e) => handleUserInputChange('currentPassword', e.target.value)}
                    placeholder="Enter current password"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={userFormData.newPassword}
                    onChange={(e) => handleUserInputChange('newPassword', e.target.value)}
                    placeholder="Enter new password"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    value={userFormData.confirmPassword}
                    onChange={(e) => handleUserInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Leave blank to keep current password
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full sm:w-auto"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          {/* AI Settings Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="ai" className="space-y-4 px-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Azure OpenAI Endpoint *
                  </label>
                  <Input
                    type="url"
                    placeholder="https://your-resource.openai.azure.com"
                    value={aiFormData.azureEndpoint}
                    onChange={(e) => handleAiInputChange('azureEndpoint', e.target.value)}
                    className="w-full text-sm"
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
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      API Version
                    </label>
                    <Input
                      value={aiFormData.apiVersion}
                      onChange={(e) => handleAiInputChange('apiVersion', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Whisper Deployment
                    </label>
                    <Input
                      value={aiFormData.whisperDeployment}
                      onChange={(e) => handleAiInputChange('whisperDeployment', e.target.value)}
                      className="w-full"
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
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-6">
                <Button
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="w-full sm:w-auto"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSettingsOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveAiSettings}
                    className="w-full sm:w-auto"
                  >
                    Save AI Settings
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                * Required fields. Use "Test Connection" to verify your Azure OpenAI setup.
              </div>
            </TabsContent>
          )}

          {/* Authentication Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="auth" className="space-y-4 px-1">
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold">PocketID Authentication (OIDC)</h3>
                <p className="text-sm text-muted-foreground">
                  Configure OpenID Connect authentication to allow users to sign in with PocketID
                </p>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start sm:items-center gap-3">
                  <input
                    type="checkbox"
                    id="oidcEnabled"
                    checked={aiFormData.oidcEnabled}
                    onChange={(e) => handleAiInputChange('oidcEnabled', e.target.checked)}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2 mt-0.5 sm:mt-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="oidcEnabled" className="text-sm font-medium cursor-pointer block">
                      Enable PocketID Authentication
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      When enabled, users will see a "Sign in with PocketID" button on the login page
                    </p>
                  </div>
                </div>
              </div>

              {aiFormData.oidcEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      OIDC Issuer URL
                    </label>
                    <Input
                      type="url"
                      placeholder="https://pocketid.app"
                      value={aiFormData.oidcIssuer}
                      onChange={(e) => handleAiInputChange('oidcIssuer', e.target.value)}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The URL of your OpenID Connect provider (default: https://pocketid.app)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Client ID *
                    </label>
                    <Input
                      placeholder="Your PocketID Client ID"
                      value={aiFormData.oidcClientId}
                      onChange={(e) => handleAiInputChange('oidcClientId', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      The client ID provided by PocketID for your application
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Client Secret *
                    </label>
                    <Input
                      type="password"
                      placeholder="Your PocketID Client Secret"
                      value={aiFormData.oidcClientSecret}
                      onChange={(e) => handleAiInputChange('oidcClientSecret', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      The client secret provided by PocketID (keep this secure)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Callback URL *
                    </label>
                    <Input
                      type="url"
                      placeholder="https://notes.rodeomasjid.org/api/auth/oidc/callback"
                      value={aiFormData.oidcCallbackUrl}
                      onChange={(e) => handleAiInputChange('oidcCallbackUrl', e.target.value)}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This must exactly match the callback URL registered in PocketID
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                      Setup Instructions
                    </h4>
                    <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                      <li>Create an application in PocketID</li>
                      <li className="break-all">Set the callback URL to: <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded text-xs">https://notes.rodeomasjid.org/api/auth/oidc/callback</code></li>
                      <li>Copy the Client ID and Client Secret from PocketID</li>
                      <li>Paste them in the fields above</li>
                      <li>Enable PocketID Authentication and save</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
                <Button
                  variant="outline"
                  onClick={() => setSettingsOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAiSettings}
                  className="w-full sm:w-auto"
                >
                  Save Authentication Settings
                </Button>
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                * Required fields when PocketID authentication is enabled
              </div>
            </TabsContent>
          )}

          {/* Users Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="users" className="space-y-4">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}