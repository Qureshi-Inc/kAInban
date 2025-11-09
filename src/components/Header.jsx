import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
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
    } else {
      loadProject(projectId)
    }
  }

  const handleDeleteProject = (projectId, e) => {
    e.stopPropagation()
    const project = projects.find(p => p.id === projectId)
    if (project && confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteProject(projectId)
      addNotification({
        type: 'success',
        message: `Project "${project.name}" deleted`
      })
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            kAInban
          </h1>
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
              <SelectItem value="none">No Project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentProject && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteProject(currentProject.id, { stopPropagation: () => {} })}
              title="Delete current project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
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