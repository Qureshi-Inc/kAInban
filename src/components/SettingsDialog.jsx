import { Settings, User, Bot, KeyRound, Users } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import apiService from '../services/apiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import UserManagement from './UserManagement'

export default function SettingsDialog() {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const addNotification = useAppStore((state) => state.addNotification)
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const deleteAllProjects = useAppStore((state) => state.deleteAllProjects)

  const [aiFormData, setAiFormData] = useState({
    provider: 'azure',
    azureEndpoint: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    apiVersion: '2024-02-01',
    whisperDeployment: 'whisper-1',
    gptDeployment: 'gpt-4',
    openaiWhisperModel: 'whisper-1',
    openaiGptModel: 'gpt-4o'
  })

  const [oidcConfig, setOidcConfig] = useState(null)

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [testingConnection, setTestingConnection] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [tenantInfo, setTenantInfo] = useState(null)

  // Sync form data when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setAiFormData({
        provider: settings.provider === 'openai' ? 'openai' : 'azure',
        azureEndpoint: settings.azureEndpoint || '',
        openaiBaseUrl: settings.openaiBaseUrl || 'https://api.openai.com/v1',
        apiKey: settings.apiKey || '',
        apiVersion: settings.apiVersion || '2024-02-01',
        whisperDeployment: settings.whisperDeployment || 'whisper-1',
        gptDeployment: settings.gptDeployment || 'gpt-4',
        openaiWhisperModel: settings.openaiWhisperModel || 'whisper-1',
        openaiGptModel: settings.openaiGptModel || 'gpt-4o'
      })
      setUserFormData({
        name: user?.name || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      // Fetch tenant information if multi-tenancy is enabled
      fetchTenantInfo()
      // Fetch OIDC config (env-driven, read-only) for the Authentication tab
      fetchOidcConfig()
    }
  }, [isSettingsOpen, settings, user])

  const fetchTenantInfo = async() => {
    try {
      const tenantData = await apiService.getTenantInfo()
      setTenantInfo(tenantData)
    } catch (error) {
      console.error('[Settings] Failed to fetch tenant info:', error)
      setTenantInfo(null)
    }
  }

  const fetchOidcConfig = async() => {
    try {
      const cfg = await apiService.getOIDCConfig()
      setOidcConfig(cfg)
    } catch (error) {
      console.error('[Settings] Failed to fetch OIDC config:', error)
      setOidcConfig(null)
    }
  }

  const handleTestConnection = async() => {
    setTestingConnection(true)

    const isOpenAI = aiFormData.provider === 'openai'

    if (isOpenAI) {
      if (!aiFormData.apiKey) {
        addNotification({
          type: 'error',
          message: 'Please fill in your OpenAI API key first'
        })
        setTestingConnection(false)
        return
      }
    } else if (!aiFormData.azureEndpoint || !aiFormData.apiKey) {
      addNotification({
        type: 'error',
        message: 'Please fill in endpoint and API key first'
      })
      setTestingConnection(false)
      return
    }

    try {
      const testUrl = isOpenAI
        ? `${(aiFormData.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/models`
        : `${aiFormData.azureEndpoint}/openai/models?api-version=${aiFormData.apiVersion}`

      const headers = isOpenAI
        ? { Authorization: `Bearer ${aiFormData.apiKey}` }
        : { 'api-key': aiFormData.apiKey }

      const response = await fetch(testUrl, { method: 'GET', headers })

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
    const isOpenAI = aiFormData.provider === 'openai'

    if (isOpenAI) {
      if (!aiFormData.apiKey) {
        addNotification({
          type: 'error',
          message: 'OpenAI API key is required'
        })
        return
      }
      if (aiFormData.openaiBaseUrl) {
        try {
          new URL(aiFormData.openaiBaseUrl)
        } catch (error) {
          addNotification({
            type: 'error',
            message: 'Please enter a valid OpenAI base URL'
          })
          return
        }
      }
    } else {
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
    }

    updateSettings(aiFormData)
    setSettingsOpen(false)

    addNotification({
      type: 'success',
      message: 'AI settings saved successfully!'
    })
  }

  const handleSaveProfile = async() => {
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

  const handleDeleteAllProjects = async() => {
    if (!confirm('Are you sure you want to delete ALL projects? This will permanently delete all your projects, tasks, meetings, and data. This action cannot be undone.')) {
      return
    }

    if (!confirm('This is your final warning. ALL your data will be permanently deleted. Type "DELETE ALL" to confirm this action.')) {
      return
    }

    try {
      await deleteAllProjects()
      addNotification({
        type: 'success',
        message: 'All projects deleted successfully'
      })
      setSettingsOpen(false)
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to delete all projects: ${error.message}`
      })
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
      <DialogContent className="w-full h-full max-w-none max-h-none overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg justify-center">
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
              {/* Tenant Information Section */}
              {tenantInfo && (
                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Organization Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Name:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">{tenantInfo.name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Access URL:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">?tenant={tenantInfo.subdomain}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Plan:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300 capitalize">{tenantInfo.plan}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Users:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">
                        {tenantInfo.stats?.users || 0} / {tenantInfo.maxUsers}
                      </span>
                    </div>
                    {tenantInfo.stats && (
                      <>
                        <div>
                          <span className="font-medium text-blue-800 dark:text-blue-200">Projects:</span>
                          <span className="ml-2 text-blue-700 dark:text-blue-300">{tenantInfo.stats.projects}</span>
                        </div>
                        <div>
                          <span className="font-medium text-blue-800 dark:text-blue-200">Tasks:</span>
                          <span className="ml-2 text-blue-700 dark:text-blue-300">{tenantInfo.stats.tasks}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

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

            {/* Danger Zone */}
            <div className="border-t border-red-200 pt-6 mt-6">
              <h3 className="text-sm font-semibold mb-4 text-red-600">Danger Zone</h3>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                      Delete All Projects
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                      This will permanently delete all your projects, tasks, meetings, and associated data. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAllProjects}
                  className="w-full sm:w-auto"
                >
                  Delete All Projects
                </Button>
              </div>
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
                {/* Provider selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI Provider *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAiInputChange('provider', 'azure')}
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                        aiFormData.provider !== 'openai'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">Azure OpenAI</span>
                      <span className="text-xs text-muted-foreground">
                        Endpoint + deployments + API key
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAiInputChange('provider', 'openai')}
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                        aiFormData.provider === 'openai'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">OpenAI</span>
                      <span className="text-xs text-muted-foreground">
                        api.openai.com / compatible
                      </span>
                    </button>
                  </div>
                </div>

                {aiFormData.provider === 'openai' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        OpenAI API Key *
                      </label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={aiFormData.apiKey}
                        onChange={(e) => handleAiInputChange('apiKey', e.target.value)}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        OpenAI Base URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://api.openai.com/v1"
                        value={aiFormData.openaiBaseUrl}
                        onChange={(e) => handleAiInputChange('openaiBaseUrl', e.target.value)}
                        className="w-full text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Override only for self-hosted or OpenAI-compatible APIs (e.g. OpenRouter, LiteLLM).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Whisper Model
                        </label>
                        <Input
                          placeholder="whisper-1"
                          value={aiFormData.openaiWhisperModel}
                          onChange={(e) => handleAiInputChange('openaiWhisperModel', e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          GPT Model
                        </label>
                        <Input
                          placeholder="gpt-4o"
                          value={aiFormData.openaiGptModel}
                          onChange={(e) => handleAiInputChange('openaiGptModel', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                * Required fields. Use "Test Connection" to verify your {aiFormData.provider === 'openai' ? 'OpenAI' : 'Azure OpenAI'} setup.
              </div>
            </TabsContent>
          )}

          {/* Authentication Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="auth" className="space-y-4 px-1">
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold">Identity Provider</h3>
                <p className="text-sm text-muted-foreground">
                  OIDC authentication is configured via environment variables on the
                  server (atomic with deploy). This tab is read-only; to change provider
                  config, update <code className="px-1 py-0.5 rounded bg-muted text-xs">.env</code> and restart the API container.
                </p>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      oidcConfig?.enabled ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">
                    {oidcConfig?.enabled ? 'OIDC enabled' : 'OIDC disabled'}
                  </span>
                  {oidcConfig?.provider && (
                    <span className="ml-auto text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {oidcConfig.provider}
                    </span>
                  )}
                </div>

                <dl className="text-sm grid grid-cols-1 gap-3 mt-2">
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Issuer</dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.issuer || <em className="text-muted-foreground">not configured</em>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Client ID</dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.clientId || <em className="text-muted-foreground">not configured</em>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Callback URL</dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.callbackUrl || <em className="text-muted-foreground">not configured</em>}
                    </dd>
                  </div>
                  {oidcConfig?.bootstrapAdminEmails?.length > 0 && (
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        Bootstrap admin emails{' '}
                        <span className="text-muted-foreground/70">(promoted only when no admin exists)</span>
                      </dt>
                      <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                        {oidcConfig.bootstrapAdminEmails.join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  How sign-in works
                </h4>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Users click <strong>Sign in</strong> and are redirected to the issuer&apos;s hosted UI</li>
                  <li>Registration, email verification, and password reset all happen at the issuer</li>
                  <li>On callback, accounts are matched by <code>(oidc_issuer, oidc_sub)</code> or linked by verified email</li>
                  <li>Logout revokes the refresh token and signs out at the issuer (SSO)</li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                Env vars: <code>ZITADEL_ISSUER</code>, <code>ZITADEL_CLIENT_ID</code>, <code>OIDC_CALLBACK_URL</code>, <code>ZITADEL_BOOTSTRAP_ADMIN_EMAILS</code>
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