import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, CheckCircle2, AlertCircle, Clock, Target, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import ReactMarkdown from 'react-markdown'
import useAppStore from '../stores/useAppStore'
import openaiService from '../services/openaiService'

const getInsightsCacheKey = (projectId) => `analytics_insights_cache_${projectId}`

export default function AnalyticsDashboard() {
  const projects = useAppStore((state) => state.projects)

  // Create a deep subscription to detect task changes in any project
  // This ensures reactivity when tasks are added/modified
  const projectsVersion = useAppStore((state) =>
    state.projects.map(p => `${p.id}:${p.tasks?.length || 0}:${p.lastModified || ''}`).join('|')
  )

  const [selectedProjectId, setSelectedProjectId] = useState('all') // 'all' or specific project ID
  const [aiInsights, setAiInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [insightsCacheTime, setInsightsCacheTime] = useState(null)
  const [lastTaskCount, setLastTaskCount] = useState(0)

  // Calculate analytics based on selected project
  const analytics = useMemo(() => {
    console.log('[AnalyticsDashboard] Recalculating analytics...')
    console.log('[AnalyticsDashboard] Projects:', projects.length)
    console.log('[AnalyticsDashboard] Selected Project ID:', selectedProjectId)
    console.log('[AnalyticsDashboard] Projects version:', projectsVersion)

    let allTasks = []

    if (selectedProjectId === 'all') {
      // Get all tasks from all projects
      projects.forEach(project => {
        if (project.tasks && project.tasks.length > 0) {
          console.log(`[AnalyticsDashboard] Project "${project.name}" has ${project.tasks.length} tasks`)
          allTasks = [...allTasks, ...project.tasks]
        }
      })
      console.log('[AnalyticsDashboard] Total tasks across all projects:', allTasks.length)
    } else {
      // Get tasks from specific selected project
      const selectedProject = projects.find(p => p.id === selectedProjectId)
      if (selectedProject && selectedProject.tasks) {
        allTasks = selectedProject.tasks
        console.log(`[AnalyticsDashboard] Selected project "${selectedProject.name}" has ${allTasks.length} tasks`)
      } else {
        console.log('[AnalyticsDashboard] Selected project not found or has no tasks')
      }
    }

    const total = allTasks.length
    const completed = allTasks.filter(t => t.status === 'done').length
    const inProgress = allTasks.filter(t => t.status === 'in-progress').length
    const blocked = allTasks.filter(t => t.status === 'blocked').length
    const todo = allTasks.filter(t => t.status === 'todo').length

    const highPriority = allTasks.filter(t => t.priority === 'high').length
    const mediumPriority = allTasks.filter(t => t.priority === 'medium').length
    const lowPriority = allTasks.filter(t => t.priority === 'low').length

    // Calculate overdue tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdue = allTasks.filter(t => {
      if (!t.dueDate || t.status === 'done') return false
      const dueDate = new Date(t.dueDate)
      return dueDate < today
    }).length

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    console.log('[AnalyticsDashboard] Analytics calculated:', { total, completed, inProgress, blocked, todo })

    return {
      total,
      completed,
      inProgress,
      blocked,
      todo,
      highPriority,
      mediumPriority,
      lowPriority,
      overdue,
      completionRate,
      tasks: allTasks // Include tasks for AI analysis
    }
  }, [projects, selectedProjectId, projectsVersion])

  // Helper function to get date at midnight
  const getMidnightDate = (date = new Date()) => {
    const midnight = new Date(date)
    midnight.setHours(0, 0, 0, 0)
    return midnight.getTime()
  }

  // Check if insights cache is still valid (expires at midnight)
  const insightsCacheValid = useMemo(() => {
    if (!insightsCacheTime) return false
    const cachedMidnight = getMidnightDate(new Date(insightsCacheTime))
    const currentMidnight = getMidnightDate()
    // Cache is valid if it's from today (after current midnight)
    return cachedMidnight >= currentMidnight
  }, [insightsCacheTime])

  // Load cached insights from localStorage when project changes
  const loadCachedInsights = (projectId) => {
    try {
      const cacheKey = getInsightsCacheKey(projectId)
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { insights, timestamp, taskCount } = JSON.parse(cached)
        const cachedMidnight = getMidnightDate(new Date(timestamp))
        const currentMidnight = getMidnightDate()

        // Only use cache if it's from today
        if (cachedMidnight >= currentMidnight) {
          console.log('[Analytics] Loading cached insights for project:', projectId)
          setAiInsights(insights)
          setInsightsCacheTime(timestamp)
          setLastTaskCount(taskCount)
          return true // Successfully loaded from cache
        } else {
          console.log('[Analytics] Cache expired for project:', projectId)
          localStorage.removeItem(cacheKey)
        }
      }
    } catch (error) {
      console.error('[Analytics] Failed to load cached insights for project:', projectId, error)
      const cacheKey = getInsightsCacheKey(projectId)
      localStorage.removeItem(cacheKey)
    }
    return false // No valid cache found
  }

  // Auto-generate insights when tasks are available and no valid cache exists
  useEffect(() => {
    const shouldGenerate =
      analytics.total > 0 && // Has tasks
      !loadingInsights && // Not already loading
      !aiInsights && // No insights currently displayed
      !insightsCacheValid // No valid cache

    if (shouldGenerate) {
      console.log('[Analytics] Auto-generating insights for', analytics.total, 'tasks in project:', selectedProjectId)
      handleGenerateInsights()
    }
  }, [analytics.total, aiInsights, insightsCacheValid, loadingInsights])

  const handleGenerateInsights = async () => {
    // Don't regenerate if already loading or if we have valid cached insights
    if (loadingInsights || (insightsCacheValid && aiInsights)) {
      console.log('[Analytics] Skipping generation - already have valid insights')
      return
    }

    setLoadingInsights(true)
    try {
      console.log('[Analytics] Generating insights for', analytics.total, 'tasks in project:', selectedProjectId)
      const insights = await openaiService.generateAnalyticsInsights(analytics)
      const timestamp = Date.now()

      setAiInsights(insights)
      setInsightsCacheTime(timestamp)
      setLastTaskCount(analytics.total)

      // Save to project-specific localStorage
      try {
        const cacheKey = getInsightsCacheKey(selectedProjectId)
        localStorage.setItem(cacheKey, JSON.stringify({
          insights,
          timestamp,
          taskCount: analytics.total
        }))
        console.log('[Analytics] Insights cached for project:', selectedProjectId)
      } catch (error) {
        console.error('[Analytics] Failed to cache insights:', error)
      }
    } catch (error) {
      console.error('[Analytics] Failed to generate insights:', error)
      setAiInsights('Failed to generate insights. Please check your Azure OpenAI configuration and try again.')
    } finally {
      setLoadingInsights(false)
    }
  }

  // Load cached insights when project changes
  useEffect(() => {
    console.log('[Analytics] Project selection changed to:', selectedProjectId)

    // Reset state
    setAiInsights(null)
    setInsightsCacheTime(null)
    setLastTaskCount(0)

    // Try to load cached insights for this specific project
    const foundCache = loadCachedInsights(selectedProjectId)
    if (foundCache) {
      console.log('[Analytics] Using cached insights for project:', selectedProjectId)
    } else {
      console.log('[Analytics] No valid cache found for project:', selectedProjectId)
    }
  }, [selectedProjectId])

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Analytics Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedProjectId === 'all'
              ? `Showing analytics across ${projects.length} projects`
              : `Showing analytics for ${projects.find(p => p.id === selectedProjectId)?.name || 'selected project'}`}
          </p>
        </div>

        {/* Project Selector */}
        <div className="w-full sm:w-64">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="font-medium">All Projects</div>
              </SelectItem>
              {projects.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Individual Projects
                  </div>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{project.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({project.tasks?.length || 0} tasks)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* AI Task Recommendations - Moved to Top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-pink-950/30 border-2 border-blue-200/30 dark:border-blue-800/30 shadow-lg">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-pulse" />

          <CardHeader className="relative bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 border-b border-blue-200/20 dark:border-blue-800/20">
            <CardTitle className="flex items-center gap-3">
              <motion.div
                className="p-2 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl shadow-lg"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Sparkles className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  kAInban Recommendations
                </span>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  Powered by intelligent task analysis
                </p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="relative p-6">
            {analytics.total === 0 ? (
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl" />
                    <Sparkles className="relative h-16 w-16 mx-auto text-blue-500/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Tasks to Analyze</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Create some tasks in your projects to unlock personalized AI insights and productivity recommendations.
                  </p>
                </motion.div>
              </div>
            ) : loadingInsights && !aiInsights ? (
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="relative mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-full blur-xl"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="relative h-16 w-16 mx-auto text-blue-500" />
                    </motion.div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Analyzing Your Tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI is reviewing your {analytics.total} tasks to generate personalized insights...
                  </p>
                </motion.div>
              </div>
            ) : aiInsights ? (
              <div className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm rounded-lg p-6 border border-white/20 dark:border-gray-800/20">
                    <ReactMarkdown
                      className="text-sm leading-relaxed"
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-300">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-lg font-semibold mb-3 text-purple-700 dark:text-purple-300">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-base font-medium mb-2 text-pink-700 dark:text-pink-300">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-none space-y-2 mb-4">{children}</ul>
                        ),
                        li: ({ children }) => (
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{children}</span>
                          </li>
                        )
                      }}
                    >
                      {aiInsights}
                    </ReactMarkdown>
                  </div>
                </div>

                {insightsCacheValid && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20 dark:border-gray-800/20"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Insights refresh daily at midnight or when you add new tasks</span>
                  </motion.div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {analytics.completionRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.completed} of {analytics.total} tasks completed
              </p>
              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${analytics.completionRate}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Tasks */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedProjectId === 'all' ? `Across ${projects.length} projects` : 'In selected project'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* In Progress */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.inProgress}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active tasks being worked on
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Overdue */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${analytics.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                {analytics.overdue}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.overdue > 0 ? 'Tasks past due date' : 'No overdue tasks'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Status Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Todo */}
              <div className="text-center p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{analytics.todo}</div>
                <div className="text-xs text-muted-foreground mt-1">To Do</div>
              </div>

              {/* In Progress */}
              <div className="text-center p-4 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.inProgress}</div>
                <div className="text-xs text-muted-foreground mt-1">In Progress</div>
              </div>

              {/* Blocked */}
              <div className="text-center p-4 rounded-lg bg-red-100 dark:bg-red-900/30">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.blocked}</div>
                <div className="text-xs text-muted-foreground mt-1">Blocked</div>
              </div>

              {/* Done */}
              <div className="text-center p-4 rounded-lg bg-green-100 dark:bg-green-900/30">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.completed}</div>
                <div className="text-xs text-muted-foreground mt-1">Done</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Priority Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* High Priority */}
              <div className="text-center p-4 rounded-lg bg-red-100 dark:bg-red-900/30">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.highPriority}</div>
                <div className="text-xs text-muted-foreground mt-1">High Priority</div>
              </div>

              {/* Medium Priority */}
              <div className="text-center p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{analytics.mediumPriority}</div>
                <div className="text-xs text-muted-foreground mt-1">Medium Priority</div>
              </div>

              {/* Low Priority */}
              <div className="text-center p-4 rounded-lg bg-green-100 dark:bg-green-900/30">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.lowPriority}</div>
                <div className="text-xs text-muted-foreground mt-1">Low Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  )
}
