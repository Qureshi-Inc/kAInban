import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MoreVertical, Home, Folder, AlertTriangle, Activity, Menu } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getShortId } from '../lib/utils'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export default function Header({ onToggleSidebar, onShowActivity }) {
  const navigate = useNavigate()
  const location = useLocation()
  const projects = useAppStore((state) => state.projects)
  const currentProject = useAppStore((state) => state.currentProject)
  const createProject = useAppStore((state) => state.createProject)
  const loadProject = useAppStore((state) => state.loadProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const addNotification = useAppStore((state) => state.addNotification)
  const clearSession = useAppStore((state) => state.clearSession)

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState(null)

  const handleCreateProject = async() => {
    if (!newProjectName.trim()) {
      addNotification({
        type: 'error',
        message: 'Please enter a project name'
      })
      return
    }

    const project = await createProject(newProjectName.trim())
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
      navigate('/')
    } else if (projectId === 'create_new') {
      setIsCreateProjectOpen(true)
    } else {
      loadProject(projectId)
      // Use short ID with new collision-resistant approach
      const shortId = getShortId(projectId)
      navigate(`/?project=${shortId}`)
    }
  }

  const handleDeleteProject = () => {
    if (!currentProject) {return}
    setProjectToDelete(currentProject)
    setIsDeleteConfirmOpen(true)
    setIsMenuOpen(false)
  }

  const confirmDeleteProject = async() => {
    if (!projectToDelete) {return}

    try {
      await deleteProject(projectToDelete.id)
      addNotification({
        type: 'success',
        message: `Project "${projectToDelete.name}" deleted successfully`
      })
      setIsDeleteConfirmOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to delete project. Please try again.'
      })
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      {/* Brand and logo with hamburger menu */}
      <div className="flex items-center gap-4">
        {/* Hamburger Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="h-10 w-10 p-0"
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <motion.div
          className="w-10 h-10 flex items-center justify-center cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={() => {
            navigate('/')
          }}
          title="Go to Dashboard"
        >
          <img src="/icon-192.png" alt="kAInban" className="w-10 h-10 object-contain" />
        </motion.div>
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                navigate('/')
              }}
              title="Go to Dashboard"
            >
              kAInban
            </h1>
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              v1.1.1
            </span>
          </div>
        </div>
      </div>

      {/* Navigation and controls */}
      <div className="flex items-center gap-4">
        {/* Project navigation */}
        <div className="flex items-center gap-3">
          <Select
            value={currentProject?.id || 'none'}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger className="w-56 h-10 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-all duration-200">
              <div className="flex items-center gap-2">
                {currentProject ? (
                  <Folder className="h-4 w-4 text-primary" />
                ) : (
                  <Home className="h-4 w-4 text-muted-foreground" />
                )}
                <SelectValue placeholder="Select workspace" />
              </div>
            </SelectTrigger>
            <SelectContent className="w-56">
              <SelectItem value="create_new">
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Plus className="h-4 w-4" />
                  Create New Project
                </div>
              </SelectItem>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  Dashboard Overview
                </div>
              </SelectItem>
              {projects.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t border-border/50 mt-1">
                    Your Projects
                  </div>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <span>{project.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Project actions menu */}
          {currentProject && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 bg-card/30 hover:bg-card/60 backdrop-blur-sm border border-border/50"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Project actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {/* Modern dropdown menu */}
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
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-52 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      <div className="p-1">
                        <button
                          onClick={handleDeleteProject}
                          className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-destructive/10 text-destructive rounded-lg transition-colors group"
                        >
                          <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          <span>Delete Project</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Activity button - only show when in a project */}
        {currentProject && onShowActivity && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowActivity}
            className="h-10 w-10 p-0 bg-card/30 hover:bg-card/60 backdrop-blur-sm border border-border/50"
            title="Show Activity"
          >
            <Activity className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Modern Create Project Dialog */}
      <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Create New Project
            </DialogTitle>
            <DialogDescription>
              Create a workspace for organizing tasks and audio recordings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Project Name</label>
              <Input
                placeholder="e.g., Marketing Campaign, Product Launch"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                className="h-11"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateProjectOpen(false)
                setNewProjectName('')
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modern Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 my-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">This will permanently delete:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-2">
                  <li>• All tasks in this project</li>
                  <li>• All audio recordings and transcriptions</li>
                  <li>• All meeting summaries and notes</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteConfirmOpen(false)
                setProjectToDelete(null)
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.header>
  )
}