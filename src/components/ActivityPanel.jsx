import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit3,
  ArrowRight,
  MessageSquare,
  Merge,
  Undo2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import apiService from '../services/apiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'

// Helper function to render **text** as bold
const renderWithBold = text => {
  if (!text) {
    return text
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

// Component to fetch and display comment content by ID
const CommentContent = ({ commentId, fallbackText }) => {
  const [comment, setComment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchComment = async() => {
      try {
        const response = await fetch(`/api/comments/${commentId}`)
        if (response.ok) {
          const commentData = await response.json()
          setComment(commentData)
        }
      } catch (error) {
        console.error('Failed to fetch comment:', error)
      } finally {
        setLoading(false)
      }
    }

    if (commentId) {
      fetchComment()
    } else {
      setLoading(false)
    }
  }, [commentId])

  if (loading) {
    return <span className="text-gray-500">Loading comment...</span>
  }

  if (comment?.content) {
    return renderWithBold(comment.content)
  }

  return fallbackText || 'AI analysis added'
}

export default function ActivityPanel({ isOpen, onClose }) {
  const currentProject = useAppStore(state => state.currentProject)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)

  // Load real change tracking data
  useEffect(() => {
    const loadActivities = async() => {
      if (!isOpen || !currentProject?.id) {
        return
      }

      setLoading(true)
      try {
        const changes = await apiService.getProjectChanges(
          currentProject.id,
          50
        )

        // Convert change tracking data to activity format
        const formattedActivities = changes.map(change => {
          // Parse metadata if it's a JSON string
          let parsedMetadata = null
          try {
            parsedMetadata = typeof change.metadata === 'string'
              ? JSON.parse(change.metadata)
              : change.metadata
          } catch (e) {
            parsedMetadata = change.metadata
          }

          // Create change object with parsed metadata for formatChangeDescription
          const changeWithParsedMetadata = {
            ...change,
            metadata: parsedMetadata
          }

          return {
            id: change.id,
            type: change.change_type,
            title: formatChangeTitle(change.change_type, change.field_name),
            description: formatChangeDescription(changeWithParsedMetadata),
            details: {
              taskTitle: change.task_title,
              field: change.field_name,
              oldValue: change.old_value,
              newValue: change.new_value,
              metadata: parsedMetadata
            },
            timestamp: new Date(change.created_at),
            user: change.user_name || change.user_email || 'Unknown User'
          }
        })

        setActivities(formattedActivities)
      } catch (error) {
        console.error('Failed to load activities:', error)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    loadActivities()
  }, [isOpen, currentProject?.id])

  // Helper functions to format change data
  const formatChangeTitle = (changeType, _fieldName) => {
    switch (changeType) {
      case 'created':
        return 'Task Created'
      case 'updated':
        return 'Task Updated'
      case 'deleted':
        return 'Task Deleted'
      case 'status_changed':
        return 'Status Changed'
      case 'priority_changed':
        return 'Priority Changed'
      case 'title_changed':
        return 'Title Changed'
      case 'description_changed':
        return 'Description Updated'
      case 'assignee_changed':
        return 'Assignee Changed'
      case 'assignees_changed':
        return 'Assignees Changed'
      case 'due_date_changed':
        return 'Due Date Changed'
      case 'ai_comment_added':
        return 'AI Comment Posted'
      case 'user_comment_added':
        return 'Comment Posted'
      case 'tasks_merged':
        return 'Tasks Merged'
      case 'merge_undone':
        return 'Merge Undone'
      default:
        return 'Task Modified'
    }
  }

  const formatChangeDescription = change => {
    // Extract task title from metadata or fallback to task_title field
    const taskTitle = change.metadata?.taskTitle || change.task_title || 'Unknown Task'

    if (change.change_type === 'created') {
      return `New task "${taskTitle}" was created`
    }
    if (change.change_type === 'deleted') {
      return `Task "${taskTitle}" was deleted`
    }
    if (change.change_type === 'ai_comment_added') {
      // Show the actual AI comment content instead of generic message
      return (
        renderWithBold(change.new_value) ||
        `AI analysis added to "${taskTitle}"`
      )
    }
    if (change.change_type === 'user_comment_added') {
      // Show the actual user comment content
      return (
        renderWithBold(change.new_value) ||
        `Comment added to "${taskTitle}"`
      )
    }
    if (change.change_type === 'assignees_changed') {
      const oldAssignees = change.old_value || 'No assignees'
      const newAssignees = change.new_value || 'No assignees'

      if (!change.old_value && change.new_value) {
        return `Task "${taskTitle}" assigned to ${change.new_value}`
      }
      if (change.old_value && !change.new_value) {
        return `Task "${taskTitle}" unassigned from ${change.old_value}`
      }
      return `Task "${taskTitle}" assignees changed from "${oldAssignees}" to "${newAssignees}"`
    }
    if (change.change_type === 'tasks_merged') {
      return renderWithBold(change.new_value) || `Merged multiple tasks into "${taskTitle}"`
    }
    if (change.change_type === 'merge_undone') {
      return renderWithBold(change.new_value) || `Undid merge of "${taskTitle}"`
    }
    if (change.field_name && change.old_value && change.new_value) {
      return `Task "${taskTitle}" ${change.field_name} changed from "${change.old_value}" to "${change.new_value}"`
    }
    return `Task "${taskTitle}" was modified`
  }

  // Fallback mock activities for demo purposes (shown when no real data)
  const mockActivities = [
    {
      id: '1',
      type: 'task_created',
      title: 'Task Created',
      description: 'New task "Review marketing materials" was created',
      details: {
        taskName: 'Review marketing materials',
        priority: 'high',
        status: 'todo'
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      user: 'AI Assistant'
    },
    {
      id: '2',
      type: 'task_updated',
      title: 'Task Updated',
      description: 'Task "Update website copy" status changed',
      details: {
        taskName: 'Update website copy',
        changes: {
          status: { from: 'todo', to: 'inprogress' },
          priority: { from: 'medium', to: 'high' }
        }
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      user: 'John Doe'
    },
    {
      id: '3',
      type: 'transcript_processed',
      title: 'Meeting Transcribed',
      description: 'Audio recording processed and 3 tasks extracted',
      details: {
        duration: '15:32',
        tasksExtracted: 3,
        filename: 'team-standup-2025.webm'
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      user: 'AI Assistant'
    },
    {
      id: '4',
      type: 'task_comment',
      title: 'Comment Added',
      description: 'Comment added to "Design new logo"',
      details: {
        taskName: 'Design new logo',
        comment: 'Please ensure the logo works well on dark backgrounds'
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      user: 'Sarah Wilson'
    },
    {
      id: '5',
      type: 'task_completed',
      title: 'Task Completed',
      description: 'Task "Set up deployment pipeline" marked as done',
      details: {
        taskName: 'Set up deployment pipeline',
        completedIn: '2 days'
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      user: 'Alex Johnson'
    }
  ]

  const getActivityIcon = type => {
    switch (type) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />
      case 'updated':
      case 'title_changed':
      case 'description_changed':
        return <Edit3 className="h-4 w-4 text-blue-500" />
      case 'status_changed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'priority_changed':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'assignee_changed':
        return <User className="h-4 w-4 text-blue-500" />
      case 'assignees_changed':
        return <User className="h-4 w-4 text-blue-500" />
      case 'due_date_changed':
        return <Calendar className="h-4 w-4 text-purple-500" />
      case 'ai_comment_added':
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      case 'user_comment_added':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'tasks_merged':
        return <Merge className="h-4 w-4 text-purple-500" />
      case 'merge_undone':
        return <Undo2 className="h-4 w-4 text-orange-500" />
      case 'deleted':
        return <X className="h-4 w-4 text-red-500" />
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTimestamp = timestamp => {
    const now = new Date()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) {
      return 'Just now'
    }
    if (minutes < 60) {
      return `${minutes}m ago`
    }
    if (hours < 24) {
      return `${hours}h ago`
    }
    return `${days}d ago`
  }

  const renderActivityDetails = activity => {
    // Show old/new values for field changes
    if (activity.details?.oldValue && activity.details?.newValue) {
      return (
        <div className="mt-2 text-xs bg-muted/50 rounded p-2">
          <span className="font-medium capitalize">
            {activity.details.field}:
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
              {activity.details.oldValue}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
              {activity.details.newValue}
            </span>
          </div>
        </div>
      )
    }

    // Show metadata if available (enhanced for AI comments)
    if (activity.details?.metadata) {
      const metadata = activity.details.metadata
      return (
        <div className="mt-2 text-xs bg-muted/50 rounded p-2 space-y-1">
          {/* Show task title prominently for AI comments */}
          {metadata.taskTitle && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400">
              <span className="font-medium text-blue-700 dark:text-blue-300">
                📝 Task:
              </span>
              <span className="ml-1 font-semibold text-blue-800 dark:text-blue-200">
                {metadata.taskTitle}
              </span>
            </div>
          )}

          {/* Show task ID for reference */}
          {metadata.taskId && (
            <div>
              <span className="font-medium">Task ID:</span>
              <code className="ml-1 px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                {metadata.taskId}
              </code>
            </div>
          )}

          {/* Show comment type */}
          {metadata.commentType && (
            <div>
              <span className="font-medium">Type:</span>
              <span className="ml-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                {metadata.commentType === 'ai_update'
                  ? 'AI Analysis'
                  : metadata.commentType}
              </span>
            </div>
          )}

          {/* Show source */}
          {metadata.source && (
            <div>
              <span className="font-medium">Source:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {metadata.source}
              </span>
            </div>
          )}

          {/* Enhanced labels for specific change types */}
          {activity.type === 'status_changed' && (metadata.taskTitle || activity.details?.taskTitle) && (
            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border-l-2 border-green-400">
              <span className="font-medium text-green-700 dark:text-green-300">
                📋 Task:
              </span>
              <span className="ml-1 font-semibold text-green-800 dark:text-green-200">
                {metadata.taskTitle || activity.details.taskTitle}
              </span>
            </div>
          )}

          {activity.type === 'due_date_changed' && (activity.details?.oldValue || activity.details?.newValue) && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border-l-2 border-purple-400">
              <span className="font-medium text-purple-700 dark:text-purple-300">
                📅 Date Change:
              </span>
              <span className="ml-1 font-semibold text-purple-800 dark:text-purple-200">
                {(() => {
                  const formatDate = (dateStr) => {
                    if (!dateStr) {return 'None'}
                    try {
                      // Parse as local date to avoid timezone issues
                      const parts = dateStr.split('-')
                      if (parts.length === 3) {
                        const date = new Date(parts[0], parts[1] - 1, parts[2])
                        return date.toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      }
                      return new Date(dateStr).toLocaleDateString()
                    } catch {
                      return dateStr
                    }
                  }
                  const fromDate = formatDate(activity.details.oldValue)
                  const toDate = formatDate(activity.details.newValue)
                  return `${fromDate} → ${toDate}`
                })()}
              </span>
            </div>
          )}

          {/* Legacy metadata fields */}
          {metadata.title && !metadata.taskTitle && (
            <div>
              <span className="font-medium">Task:</span> {metadata.title}
            </div>
          )}
          {metadata.status && (
            <div>
              <span className="font-medium">Status:</span> {metadata.status}
            </div>
          )}
          {metadata.priority && (
            <div>
              <span className="font-medium">Priority:</span> {metadata.priority}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Activity Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-card/95 backdrop-blur-lg border-l border-border/50 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Activity</h2>
                    <p className="text-sm text-muted-foreground">
                      {currentProject
                        ? `${currentProject.name}`
                        : 'All Projects'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading activity...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative"
                    >
                      {/* Timeline line */}
                      {index < activities.length - 1 && (
                        <div className="absolute left-6 top-12 bottom-0 w-px bg-border/30" />
                      )}

                      {/* Activity item */}
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-xl bg-background border border-border/50 flex items-center justify-center flex-shrink-0">
                          {getActivityIcon(activity.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {activity.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {activity.description}
                              </p>
                            </div>
                            <time className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTimestamp(activity.timestamp)}
                            </time>
                          </div>

                          {/* Activity details */}
                          {renderActivityDetails(activity)}

                          {/* User info */}
                          <div className="flex items-center gap-2 mt-3">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {activity.user}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Empty state */}
                  {activities.length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No recent activity
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Activity will appear here as you work on tasks
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/50 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Last updated{' '}
                  {formatTimestamp(new Date(Date.now() - 1000 * 60))}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
