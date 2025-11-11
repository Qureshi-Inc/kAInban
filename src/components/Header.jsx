import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Plus, Trash2, MoreVertical } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import useAppStore from '../stores/useAppStore'

export default function Header() {
  const projects = useAppStore((state) => state.projects)
  const currentProject = useAppStore((state) => state.currentProject)
  const createProject = useAppStore((state) => state.createProject)
  const loadProject = useAppStore((state) => state.loadProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const addNotification = useAppStore((state) => state.addNotification)
  const clearSession = useAppStore((state) => state.clearSession)

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      addNotification({
        type: 'error',
        message: 'Please enter a project name'
      })
      return
    }

    const project = await createProject(newProjectName.trim())
    console.log('[Header] Project created:', project)
    console.log('[Header] Project name:', project?.name)

    setNewProjectName('')
    setIsCreateProjectOpen(false)

    addNotification({
      type: 'success',
      message: `Project "${project?.name || 'Unknown'}" created successfully`
    })
  }

  const handleProjectChange = (projectId) => {
    if (projectId === 'none') {
      clearSession()
    } else if (projectId === 'create_new') {
      setIsCreateProjectOpen(true)
    } else {
      loadProject(projectId)
    }
  }

  const handleDeleteProject = () => {
    if (!currentProject) return

    if (confirm(`Are you sure you want to delete "${currentProject.name}"?`)) {
      deleteProject(currentProject.id)
      addNotification({
        type: 'success',
        message: `Project "${currentProject.name}" deleted`
      })
      setIsMenuOpen(false)
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-2 border-gradient-to-r from-primary/20 via-primary/10 to-transparent"
    >
      <div className="flex items-center gap-4">
        <motion.div
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-2xl shadow-lg ring-2 ring-primary/20"
          whileHover={{ scale: 1.1, rotate: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          🎤
        </motion.div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              kAInban
            </h1>
            <span className="text-xs font-semibold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-md">
              v2.7
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Organize Tasks with AI</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={currentProject?.id || 'none'}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="create_new">
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Plus className="h-4 w-4" />
                  Create Project
                </div>
              </SelectItem>
              <SelectItem value="none">Dashboard</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project Menu */}
          {currentProject && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Project options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMenuOpen(false)}
                    />

                    {/* Menu */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                    >
                      <button
                        onClick={handleDeleteProject}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Project
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Create Project Dialog */}
          <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateProjectOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject}>
                    Create Project
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </motion.header>
  )
}