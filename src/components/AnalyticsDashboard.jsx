import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, CheckCircle2, AlertCircle, Clock, Target, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import useAppStore from '../stores/useAppStore'
import openaiService from '../services/openaiService'

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

  // Check if insights cache is still valid (1 hour)
  const insightsCacheValid = useMemo(() => {
    if (!insightsCacheTime) return false
    const oneHour = 60 * 60 * 1000
    return (Date.now() - insightsCacheTime) < oneHour
  }, [insightsCacheTime])

  const handleGenerateInsights = async () => {
    // Check cache first
    if (insightsCacheValid && aiInsights) {
      return // Use cached insights
    }

    setLoadingInsights(true)
    try {
      const insights = await openaiService.generateAnalyticsInsights(analytics)
      setAiInsights(insights)
      setInsightsCacheTime(Date.now())
    } catch (error) {
      console.error('[Analytics] Failed to generate insights:', error)
      setAiInsights('Failed to generate insights. Please check your Azure OpenAI configuration and try again.')
    } finally {
      setLoadingInsights(false)
    }
  }

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.2 }}
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
          transition={{ delay: 0.3 }}
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
          transition={{ delay: 0.4 }}
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
        transition={{ delay: 0.5 }}
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
        transition={{ delay: 0.6 }}
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

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-Powered Insights
            </CardTitle>
            <Button
              onClick={handleGenerateInsights}
              disabled={loadingInsights || analytics.total === 0}
              size="sm"
            >
              {loadingInsights ? 'Generating...' : insightsCacheValid ? 'Refresh Insights' : 'Generate Insights'}
            </Button>
          </CardHeader>
          <CardContent>
            {analytics.total === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No tasks available for analysis.</p>
                <p className="text-sm mt-2">Create some tasks to see AI-powered insights!</p>
              </div>
            ) : aiInsights ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {aiInsights}
                </div>
                {insightsCacheValid && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Insights cached for 1 hour. Click "Refresh Insights" to regenerate.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Generate Insights" to get AI-powered analysis of your tasks.</p>
                <p className="text-sm mt-2">
                  Get productivity patterns, bottleneck identification, and actionable recommendations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
