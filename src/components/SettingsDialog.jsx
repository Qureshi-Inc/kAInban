import { Settings, User, KeyRound, Users } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import apiService from '../services/apiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import UserManagement from './UserManagement'

export default function SettingsDialog() {
  const isSettingsOpen = useAppStore(state => state.isSettingsOpen)
  const setSettingsOpen = useAppStore(state => state.setSettingsOpen)
  const addNotification = useAppStore(state => state.addNotification)
  const user = useAppStore(state => state.user)
  const setUser = useAppStore(state => state.setUser)
  const deleteAllProjects = useAppStore(state => state.deleteAllProjects)

  const [oidcConfig, setOidcConfig] = useState(null)

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [savingProfile, setSavingProfile] = useState(false)
  const [tenantInfo, setTenantInfo] = useState(null)

  // Sync form data when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
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
  }, [isSettingsOpen, user])

  const fetchTenantInfo = async () => {
    try {
      const tenantData = await apiService.getTenantInfo()
      setTenantInfo(tenantData)
    } catch (error) {
      console.error('[Settings] Failed to fetch tenant info:', error)
      setTenantInfo(null)
    }
  }

  const fetchOidcConfig = async () => {
    try {
      const cfg = await apiService.getOIDCConfig()
      setOidcConfig(cfg)
    } catch (error) {
      console.error('[Settings] Failed to fetch OIDC config:', error)
      setOidcConfig(null)
    }
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

  const handleDeleteAllProjects = async () => {
    if (
      !confirm(
        'Are you sure you want to delete ALL projects? This will permanently delete all your projects, tasks, meetings, and data. This action cannot be undone.'
      )
    ) {
      return
    }

    if (
      !confirm(
        'This is your final warning. ALL your data will be permanently deleted. Type "DELETE ALL" to confirm this action.'
      )
    ) {
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
          {/* AI Settings tab removed: AI provider config (keys, endpoint,
              models) is now managed server-side via env vars after the
              security refactor. The /api/settings DB override still
              exists for emergencies but doesn't need a UI surface. */}
          <TabsList
            className={`grid w-full gap-1 ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} ${isAdmin ? 'p-1 h-auto min-h-[2.5rem]' : 'h-10'}`}
          >
            <TabsTrigger
              value="general"
              className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]"
            >
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">General</span>
              <span className="sm:hidden text-xs">Profile</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger
                  value="auth"
                  className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]"
                >
                  <KeyRound className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden lg:inline">Authentication</span>
                  <span className="lg:hidden text-xs">Auth</span>
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="flex-1 text-xs sm:text-sm px-1 sm:px-3 py-2 min-h-[2rem] sm:min-h-[2.5rem]"
                >
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
                <div className="p-4 border rounded-lg bg-info/10 border-info/30">
                  <h3 className="text-sm font-semibold text-info mb-3 flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Organization Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-info">Name:</span>
                      <span className="ml-2 text-info">{tenantInfo.name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-info">Access URL:</span>
                      <span className="ml-2 text-info">
                        ?tenant={tenantInfo.subdomain}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-info">Plan:</span>
                      <span className="ml-2 text-info capitalize">
                        {tenantInfo.plan}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-info">Users:</span>
                      <span className="ml-2 text-info">
                        {tenantInfo.stats?.users || 0} / {tenantInfo.maxUsers}
                      </span>
                    </div>
                    {tenantInfo.stats && (
                      <>
                        <div>
                          <span className="font-medium text-info">
                            Projects:
                          </span>
                          <span className="ml-2 text-info">
                            {tenantInfo.stats.projects}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-info">Tasks:</span>
                          <span className="ml-2 text-info">
                            {tenantInfo.stats.tasks}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Name</div>
                <Input
                  value={userFormData.name}
                  onChange={e => handleUserInputChange('name', e.target.value)}
                  placeholder="Your name"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Email</div>
                <Input
                  type="email"
                  value={userFormData.email}
                  onChange={e => handleUserInputChange('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full"
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-sm font-semibold mb-4">Change Password</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Current Password</div>
                  <Input
                    type="password"
                    value={userFormData.currentPassword}
                    onChange={e =>
                      handleUserInputChange('currentPassword', e.target.value)
                    }
                    placeholder="Enter current password"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">New Password</div>
                  <Input
                    type="password"
                    value={userFormData.newPassword}
                    onChange={e =>
                      handleUserInputChange('newPassword', e.target.value)
                    }
                    placeholder="Enter new password"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Confirm New Password
                  </div>
                  <Input
                    type="password"
                    value={userFormData.confirmPassword}
                    onChange={e =>
                      handleUserInputChange('confirmPassword', e.target.value)
                    }
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
            <div className="border-t border-destructive/30 pt-6 mt-6">
              <h3 className="text-sm font-semibold mb-4 text-destructive">
                Danger Zone
              </h3>

              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-destructive mb-1">
                      Delete All Projects
                    </h4>
                    <p className="text-xs text-destructive mb-3">
                      This will permanently delete all your projects, tasks,
                      meetings, and associated data. This action cannot be
                      undone.
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

          {/* Authentication Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="auth" className="space-y-4 px-1">
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold">Identity Provider</h3>
                <p className="text-sm text-muted-foreground">
                  OIDC authentication is configured via environment variables on
                  the server (atomic with deploy). This tab is read-only; to
                  change provider config, update{' '}
                  <code className="px-1 py-0.5 rounded bg-muted text-xs">
                    .env
                  </code>{' '}
                  and restart the API container.
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
                    <dt className="text-xs text-muted-foreground mb-0.5">
                      Issuer
                    </dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.issuer || (
                        <em className="text-muted-foreground">
                          not configured
                        </em>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">
                      Client ID
                    </dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.clientId || (
                        <em className="text-muted-foreground">
                          not configured
                        </em>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">
                      Callback URL
                    </dt>
                    <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                      {oidcConfig?.callbackUrl || (
                        <em className="text-muted-foreground">
                          not configured
                        </em>
                      )}
                    </dd>
                  </div>
                  {oidcConfig?.bootstrapAdminEmails?.length > 0 && (
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        Bootstrap admin emails{' '}
                        <span className="text-muted-foreground/70">
                          (promoted only when no admin exists)
                        </span>
                      </dt>
                      <dd className="font-mono text-xs break-all p-2 rounded bg-background border">
                        {oidcConfig.bootstrapAdminEmails.join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                <h4 className="text-sm font-semibold text-info mb-2">
                  How sign-in works
                </h4>
                <ul className="text-xs text-info space-y-1 list-disc list-inside">
                  <li>
                    Users click <strong>Sign in</strong> and are redirected to
                    the issuer&apos;s hosted UI
                  </li>
                  <li>
                    Registration, email verification, and password reset all
                    happen at the issuer
                  </li>
                  <li>
                    On callback, accounts are matched by{' '}
                    <code>(oidc_issuer, oidc_sub)</code> or linked by verified
                    email
                  </li>
                  <li>
                    Logout revokes the refresh token and signs out at the issuer
                    (SSO)
                  </li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                Env vars: <code>ZITADEL_ISSUER</code>,{' '}
                <code>ZITADEL_CLIENT_ID</code>, <code>OIDC_CALLBACK_URL</code>,{' '}
                <code>ZITADEL_BOOTSTRAP_ADMIN_EMAILS</code>
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
