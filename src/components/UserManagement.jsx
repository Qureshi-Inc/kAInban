import { motion } from 'framer-motion'
import { Users, Mail, Shield, Key, Trash2, Clock } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'

// Map an OIDC issuer URL to a human label. Falls back to the hostname for
// unknown issuers, then to "SSO" if the URL fails to parse.
function oidcProviderLabel(issuer) {
  if (!issuer) {return 'SSO'}
  if (issuer.includes('auth.kainban.com')) {return 'Zitadel'}
  if (issuer.includes('login.qureshi.io')) {return 'PocketID (legacy)'}
  try {
    return new URL(issuer).hostname
  } catch (_e) {
    return 'SSO'
  }
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const addNotification = useAppStore((state) => state.addNotification)
  const user = useAppStore((state) => state.user)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async() => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('[UserManagement] Fetch error:', error)
      addNotification({
        type: 'error',
        message: 'Failed to load users'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async(userId, userName) => {
    const warningMessage = `⚠️  PERMANENT DELETION WARNING ⚠️

Are you sure you want to delete user "${userName}"?

This will PERMANENTLY DELETE ALL of their data:
• All projects created by this user
• All tasks within those projects
• All audio recordings and transcriptions
• All meeting summaries and notes
• All personal settings and preferences

This action cannot be undone. Their identity-provider account remains intact - they can create a new account in the app if needed.

Type "DELETE" to confirm:`

    const userInput = prompt(warningMessage)
    if (userInput !== 'DELETE') {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      addNotification({
        type: 'success',
        message: `User "${userName}" deleted successfully`
      })

      // Refresh the user list
      fetchUsers()
    } catch (error) {
      console.error('[UserManagement] Delete error:', error)
      addNotification({
        type: 'error',
        message: error.message
      })
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) {return 'Never'}
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-2 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        <h2 className="text-lg sm:text-2xl font-bold">User Management</h2>
      </div>

      {/* Mobile Card View (sm and below) */}
      <div className="block sm:hidden space-y-3">
        {users.map((u) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-lg shadow p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                {u.picture ? (
                  <img
                    src={u.picture}
                    alt={u.name}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold text-sm">
                      {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {u.name || 'No name'}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                </div>
              </div>
              {u.id !== user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                  className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium text-muted-foreground">Auth Method</span>
                <div className="flex items-center gap-1 mt-1">
                  {u.auth_provider === 'oidc' ? (
                    <>
                      <Key className="h-3 w-3 text-blue-500" />
                      <span className="text-info">
                        {oidcProviderLabel(u.oidc_issuer)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Email</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <span className="font-medium text-muted-foreground">Role</span>
                <div className="mt-1">
                  {u.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Shield className="h-2.5 w-2.5" />
                      Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                      Member
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <span className="font-medium text-muted-foreground text-xs">Last Login</span>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(u.last_login)}
              </div>
            </div>
          </motion.div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-12 bg-card rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No users</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No users found in the system.
            </p>
          </div>
        )}
      </div>

      {/* Desktop Table View (sm and above) */}
      <div className="hidden sm:block bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Auth Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((u) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-secondary transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {u.picture ? (
                        <img
                          src={u.picture}
                          alt={u.name}
                          className="h-10 w-10 rounded-full mr-3"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                          <span className="text-primary font-semibold">
                            {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {u.name || 'No name'}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {u.auth_provider === 'oidc' ? (
                        <>
                          <Key className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-info">
                            {oidcProviderLabel(u.oidc_issuer)}
                          </span>
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Email/Password
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(u.last_login)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                        className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No users</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No users found in the system.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs sm:text-sm text-muted-foreground grid grid-cols-2 sm:flex sm:space-x-6 gap-2 sm:gap-0">
        <p>Total users: {users.length}</p>
        <p>Admins: {users.filter(u => u.role === 'admin').length}</p>
        <p>OIDC users: {users.filter(u => u.auth_provider === 'oidc').length}</p>
        <p>Email users: {users.filter(u => u.auth_provider === 'local').length}</p>
      </div>
    </div>
  )
}
