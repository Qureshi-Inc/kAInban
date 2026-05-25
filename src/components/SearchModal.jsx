import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, FolderOpen } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getShortId } from '../lib/utils'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'

export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const projects = useAppStore((state) => state.projects)
  const loadProject = useAppStore((state) => state.loadProject)

  // Search through all projects and tasks
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const query = searchQuery.toLowerCase()
    const results = []

    projects.forEach((project) => {
      if (project.tasks) {
        project.tasks.forEach((task) => {
          // Search in title, description, and assignee
          const matchesTitle = task.title?.toLowerCase().includes(query)
          const matchesDescription = task.description?.toLowerCase().includes(query)
          const matchesAssignee = task.assignee?.toLowerCase().includes(query)

          if (matchesTitle || matchesDescription || matchesAssignee) {
            results.push({
              task,
              project,
              matchType: matchesTitle ? 'title' : matchesDescription ? 'description' : 'assignee'
            })
          }
        })
      }
    })

    setSearchResults(results)
  }, [searchQuery, projects])

  const handleTaskClick = async(result) => {
    // Load the project first
    await loadProject(result.project.id)

    // Navigate to project with full task ID to open the task
    const shortProjectId = getShortId(result.project.id)
    navigate(`/?project=${shortProjectId}&task=${result.task.id}`)

    // Close search modal
    onClose()
  }

  const handleClose = () => {
    setSearchQuery('')
    setSearchResults([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 justify-center">
            <Search className="h-5 w-5" />
            Search Tasks
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by task name, description, or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {searchQuery && searchResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No tasks found matching "{searchQuery}"</p>
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Start typing to search tasks across all projects</p>
            </div>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {searchResults.map((result, index) => (
                <motion.div
                  key={`${result.project.id}-${result.task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => handleTaskClick(result)}
                    className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                          result.task.status === 'done'
                            ? 'bg-green-500'
                            : result.task.status === 'in-progress'
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground mb-1">
                          {result.task.title}
                        </div>
                        {result.task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {result.task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FolderOpen className="h-3 w-3" />
                          <span>{result.project.name}</span>
                          <span>•</span>
                          <span className="capitalize">{result.task.priority || 'medium'}</span>
                          {result.task.assignee && (
                            <>
                              <span>•</span>
                              <span>{result.task.assignee}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
