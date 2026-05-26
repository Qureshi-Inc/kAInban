import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Merge,
  Undo2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../services/apiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'

export default function TaskGroupingModal({ open, onOpenChange }) {
  const { currentProject, addNotification, loadProject } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [similarGroups, setSimilarGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [merging, setMerging] = useState(new Set())
  const [recentMerges, setRecentMerges] = useState([])
  const [selectedTasksInGroups, setSelectedTasksInGroups] = useState(new Map()) // groupId -> Set of taskIds
  const [showMergeHistory, setShowMergeHistory] = useState(false)

  // Load similar task groups when modal opens
  useEffect(() => {
    if (open && currentProject?.id) {
      loadSimilarTasks()
    }
  }, [open, currentProject?.id])

  const loadSimilarTasks = async() => {
    if (!currentProject?.id) {
      return
    }

    setLoading(true)
    try {
      // Load both similar tasks and recent merges in parallel
      const [groups, recentMergesData] = await Promise.all([
        apiService.detectSimilarTasks(currentProject.id),
        apiService.getRecentMerges(currentProject.id)
      ])

      setSimilarGroups(groups)
      setRecentMerges(recentMergesData)
      setSelectedGroups(new Set())

      console.log('[TaskGrouping] State updated:', {
        similarGroupsCount: groups?.length || 0,
        recentMergesCount: recentMergesData?.length || 0,
        recentMergesData
      })

      if (groups.length === 0) {
        addNotification({
          type: 'info',
          message: 'No similar tasks detected. Your tasks are well organized!'
        })
      }
    } catch (error) {
      console.error('[TaskGrouping] Load error:', error)
      addNotification({
        type: 'error',
        message: `Failed to load task data: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGroupSelection = (groupId, selected) => {
    const newSelection = new Set(selectedGroups)
    if (selected) {
      newSelection.add(groupId)
      // Auto-select all tasks in the group when group is selected
      const group = similarGroups.find(g => g.id === groupId)
      if (group) {
        setSelectedTasksInGroups(prev => {
          const newMap = new Map(prev)
          newMap.set(groupId, new Set(group.tasks.map(t => t.id)))
          return newMap
        })
      }
    } else {
      newSelection.delete(groupId)
      // Clear individual task selections when group is deselected
      setSelectedTasksInGroups(prev => {
        const newMap = new Map(prev)
        newMap.delete(groupId)
        return newMap
      })
    }
    setSelectedGroups(newSelection)
  }

  const handleTaskSelection = (groupId, taskId, selected) => {
    setSelectedTasksInGroups(prev => {
      const newMap = new Map(prev)
      const currentTasks = newMap.get(groupId) || new Set()

      if (selected) {
        currentTasks.add(taskId)
      } else {
        currentTasks.delete(taskId)
      }

      if (currentTasks.size === 0) {
        newMap.delete(groupId)
        // Also deselect the group if no tasks are selected
        setSelectedGroups(prevGroups => {
          const newGroups = new Set(prevGroups)
          newGroups.delete(groupId)
          return newGroups
        })
      } else {
        newMap.set(groupId, new Set(currentTasks))
        // Ensure group is selected if tasks are selected
        setSelectedGroups(prevGroups => new Set([...prevGroups, groupId]))
      }

      return newMap
    })
  }

  const getSelectedTasksForGroup = (groupId) => {
    return selectedTasksInGroups.get(groupId) || new Set()
  }

  const canMergeGroup = (groupId) => {
    const selectedTasks = getSelectedTasksForGroup(groupId)
    const group = similarGroups.find(g => g.id === groupId)

    // Can merge if either:
    // 1. At least 2 individual tasks are selected, OR
    // 2. No individual tasks selected but group has at least 2 tasks total
    return selectedTasks.size >= 2 || (selectedTasks.size === 0 && group?.tasks?.length >= 2)
  }

  const mergeTasks = async group => {
    if (!currentProject?.id) {
      return
    }

    const groupId = group.id
    const selectedTaskIds = Array.from(getSelectedTasksForGroup(groupId))

    // Use selected tasks if any, otherwise all tasks in group
    const tasksToMerge = selectedTaskIds.length >= 2
      ? group.tasks.filter(task => selectedTaskIds.includes(task.id))
      : group.tasks

    if (tasksToMerge.length < 2) {
      addNotification({
        type: 'error',
        message: 'Please select at least 2 tasks to merge'
      })
      return
    }

    setMerging(prev => new Set([...prev, groupId]))

    try {
      const taskIds = tasksToMerge.map(task => task.id)
      const result = await apiService.mergeTasks(
        currentProject.id,
        taskIds,
        'smart'
      )

      // Track recent merge for undo functionality
      const mergeRecord = {
        id: result.mergeId,
        title: result.mergedTask.title,
        originalTasks: tasksToMerge.map(t => ({ id: t.id, title: t.title })),
        timestamp: new Date().toISOString()
      }
      setRecentMerges(prev => {
        const updated = [mergeRecord, ...prev.slice(0, 4)]
        return updated
      })

      // Remove merged group from similar groups
      setSimilarGroups(prev => prev.filter(g => g.id !== groupId))
      setSelectedGroups(prev => {
        const newSet = new Set(prev)
        newSet.delete(groupId)
        return newSet
      })
      // Clear individual task selections
      setSelectedTasksInGroups(prev => {
        const newMap = new Map(prev)
        newMap.delete(groupId)
        return newMap
      })

      // Reload project to show updated tasks
      await loadProject(currentProject.id)

      addNotification({
        type: 'success',
        message: `Successfully merged ${tasksToMerge.length} tasks into "${result.mergedTask.title}"`
      })
    } catch (error) {
      console.error('[TaskGrouping] Merge error:', error)
      addNotification({
        type: 'error',
        message: `Failed to merge tasks: ${error.message}`
      })
    } finally {
      setMerging(prev => {
        const newSet = new Set(prev)
        newSet.delete(groupId)
        return newSet
      })
    }
  }

  const undoMerge = async mergeRecord => {
    if (!currentProject?.id) {
      return
    }

    try {
      const result = await apiService.undoMerge(
        currentProject.id,
        mergeRecord.id
      )

      // Remove from recent merges
      setRecentMerges(prev => prev.filter(m => m.id !== mergeRecord.id))

      // Reload project to show restored tasks
      await loadProject(currentProject.id)

      addNotification({
        type: 'success',
        message: `Undid merge - restored ${result.restoredTasks.length} original tasks`
      })

      // Reload similar tasks to potentially show new groups
      await loadSimilarTasks()
    } catch (error) {
      console.error('[TaskGrouping] Undo error:', error)
      addNotification({
        type: 'error',
        message: `Failed to undo merge: ${error.message}`
      })
    }
  }

  const mergeSelectedGroups = async() => {
    const groupsToMerge = similarGroups.filter(g => selectedGroups.has(g.id))

    for (const group of groupsToMerge) {
      await mergeTasks(group)
    }
  }

  const getConfidenceColor = confidence => {
    switch (confidence) {
      case 'high':
        return 'text-success'
      case 'medium':
        return 'text-warning dark:text-warning'
      default:
        return 'text-muted-foreground'
    }
  }

  const getConfidenceIcon = confidence => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="h-4 w-4" />
      case 'medium':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="task-modal-overlay"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-card rounded-lg shadow-2xl w-full h-full max-w-none max-h-none overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Smart Task Grouping
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    AI-detected similar tasks that can be merged
                  </p>
                </div>
              </div>

              {/* Merge History Button and Close Button */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowMergeHistory(!showMergeHistory)
                  }}
                  className="flex items-center gap-2 text-info border-info/30 hover:bg-info/10 dark:hover:bg-blue-900/20"
                >
                  <Clock className="h-4 w-4" />
                  Merge History
                  {recentMerges.length > 0 && (
                    <span className="bg-info/15 dark:bg-blue-900 text-info text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {recentMerges.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-muted-foreground">
                    Analyzing tasks for similarities...
                  </span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Recent Merges - Undo Section */}
                  {showMergeHistory && (
                    <div
                      data-section="recent-merges"
                      className="bg-info/10 rounded-lg p-4 border border-info/30"
                    >
                      <h3 className="text-sm font-semibold text-info mb-3 flex items-center gap-2">
                        <Undo2 className="h-4 w-4" />
                        Merge History
                        {recentMerges.length > 0 && (
                          <span className="bg-info/15 dark:bg-blue-900 text-info text-xs px-1.5 py-0.5 rounded-full font-medium ml-2">
                            {recentMerges.length}
                          </span>
                        )}
                      </h3>
                      {recentMerges.length > 0 ? (
                        <div className="space-y-2">
                          {recentMerges.map(merge => (
                            <div
                              key={merge.id}
                              className="flex items-center justify-between p-2 bg-card rounded border border-info/30"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {merge.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Merged {merge.originalTasks.length} tasks •{' '}
                                  {new Date(merge.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => undoMerge(merge)}
                                className="ml-2 flex items-center gap-1"
                              >
                                <Undo2 className="h-3 w-3" />
                                Undo
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-info">
                            No recent merges found
                          </p>
                          <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                            Merged tasks will appear here with undo options
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Similar Task Groups */}
                  {similarGroups.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Found {similarGroups.length} group(s) of similar tasks
                        </p>
                        {selectedGroups.size > 0 && (
                          <Button
                            onClick={mergeSelectedGroups}
                            className="flex items-center gap-2"
                            disabled={Array.from(selectedGroups).some(groupId =>
                              merging.has(groupId)
                            )}
                          >
                            <Merge className="h-4 w-4" />
                            Merge Selected ({selectedGroups.size})
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {similarGroups.map(group => (
                          <div
                            key={group.id}
                            className="border border-border rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedGroups.has(group.id)}
                                  onChange={e =>
                                    handleGroupSelection(
                                      group.id,
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 text-purple-600 border-input rounded focus:ring-purple-500"
                                />
                                <div>
                                  <div
                                    className={`flex items-center gap-2 ${getConfidenceColor(group.similarity.confidence)}`}
                                  >
                                    {getConfidenceIcon(
                                      group.similarity.confidence
                                    )}
                                    <span className="text-sm font-medium capitalize">
                                      {group.similarity.confidence} confidence
                                    </span>
                                    <span className="text-xs">
                                      ({Math.round(group.similarity.score * 100)}%
                                      match)
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {group.reason}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => mergeTasks(group)}
                                disabled={merging.has(group.id) || !canMergeGroup(group.id)}
                                className="flex items-center gap-2"
                              >
                                {merging.has(group.id) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                    Merging...
                                  </>
                                ) : (
                                  <>
                                    <Merge className="h-3 w-3" />
                                    {getSelectedTasksForGroup(group.id).size > 0
                                      ? `Merge Selected (${getSelectedTasksForGroup(group.id).size})`
                                      : 'Merge All'
                                    }
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Task List */}
                            <div className="space-y-2">
                              {group.tasks.map((task, index) => {
                                const selectedTasks = getSelectedTasksForGroup(group.id)
                                const isTaskSelected = selectedTasks.has(task.id)

                                return (
                                  <div
                                    key={task.id}
                                    className={`flex items-center gap-3 p-2 rounded border transition-colors ${
                                      isTaskSelected
                                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'
                                        : 'bg-muted border-transparent'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isTaskSelected}
                                      onChange={(e) => handleTaskSelection(group.id, task.id, e.target.checked)}
                                      className="w-4 h-4 text-purple-600 border-input rounded focus:ring-purple-500 flex-shrink-0"
                                    />
                                    <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-semibold text-purple-600 dark:text-purple-400 flex-shrink-0">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {task.title}
                                      </p>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {task.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            task.status === 'done'
                                              ? 'bg-success/15 text-success'
                                              : task.status === 'in-progress'
                                                ? 'bg-info/15 text-info'
                                                : task.status === 'blocked'
                                                  ? 'bg-destructive/15 text-destructive'
                                                  : 'bg-muted text-foreground'
                                          }`}
                                        >
                                          {task.status}
                                        </span>
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            task.priority === 'high'
                                              ? 'bg-destructive/15 text-destructive'
                                              : task.priority === 'medium'
                                                ? 'bg-warning/15 text-warning'
                                                : 'bg-muted text-foreground'
                                          }`}
                                        >
                                          {task.priority}
                                        </span>
                                        {task.assignee && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-info/15 text-info">
                                            {task.assignee}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-success" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No Similar Tasks Found
                      </h3>
                      <p className="text-muted-foreground">
                        Your tasks are already well organized! No duplicates or
                        similar tasks detected.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-muted">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  AI analyzes task titles, descriptions, assignees, and workflow
                  patterns
                </p>
                <Button variant="outline" onClick={() => loadSimilarTasks()}>
                  Refresh Analysis
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
