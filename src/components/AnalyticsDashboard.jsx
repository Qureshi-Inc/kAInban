import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, TrendingUp, CheckCircle2, AlertCircle, Clock, Target, Sparkles, Filter } from 'lucide-react'
import React, { useState, useMemo, useEffect } from 'react'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/autoplay'
import 'swiper/css/effect-fade'
import ReactMarkdown from 'react-markdown'
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const getInsightsCacheKey = (projectId) => `analytics_insights_cache_${projectId}`

export default function AnalyticsDashboard() {
  const projects = useAppStore((state) => state.projects)

  // Create a deep subscription to detect task changes in any project
  // This ensures reactivity when tasks are added/modified
  const projectsVersion = useAppStore((state) =>
    state.projects.map(p => `${p.id}:${p.tasks?.length || 0}:${p.lastModified || ''}`).join('|')
  )

  const [selectedProjectId, setSelectedProjectId] = useState('all') // 'all' or specific project ID
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [aiInsights, setAiInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [insightsCacheTime, setInsightsCacheTime] = useState(null)
  const [lastTaskCount, setLastTaskCount] = useState(0)

  // Calculate analytics based on selected project
  const analytics = useMemo(() => {
    let allTasks = []

    if (selectedProjectId === 'all') {
      // Get all tasks from all projects
      projects.forEach(project => {
        if (project.tasks && project.tasks.length > 0) {
          allTasks = [...allTasks, ...project.tasks]
        }
      })
    } else {
      // Get tasks from specific selected project
      const selectedProject = projects.find(p => p.id === selectedProjectId)
      if (selectedProject && selectedProject.tasks) {
        allTasks = selectedProject.tasks
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
      if (!t.dueDate || t.status === 'done') {return false}
      const dueDate = new Date(t.dueDate)
      return dueDate < today
    }).length

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0


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
    if (!insightsCacheTime) {return false}
    const cachedMidnight = getMidnightDate(new Date(insightsCacheTime))
    const currentMidnight = getMidnightDate()
    // Cache is valid if it's from today (after current midnight)
    return cachedMidnight >= currentMidnight
  }, [insightsCacheTime])

  // Load cached insights from server/localStorage when project changes
  const loadCachedInsights = async(projectId) => {
    try {
      const cached = await apiService.loadAnalyticsInsights(projectId)
      if (cached) {
        const { insights, timestamp, taskCount } = cached
        const cachedMidnight = getMidnightDate(new Date(timestamp))
        const currentMidnight = getMidnightDate()

        // Only use cache if it's from today
        if (cachedMidnight >= currentMidnight) {
          setAiInsights(insights)
          setInsightsCacheTime(timestamp)
          setLastTaskCount(taskCount)
          return true // Successfully loaded from cache
        } else {
          // Clear expired cache
          await apiService.clearAnalyticsInsights(projectId)
        }
      }
    } catch (error) {
      console.error('[Analytics] Failed to load cached insights for project:', projectId, error)
      await apiService.clearAnalyticsInsights(projectId)
    }
    return false // No valid cache found
  }


  // Parse AI insights into carousel items
  const parseInsightsIntoCarousel = (insights) => {
    if (!insights) {return []}

    // Split by the ** markers and filter out empty parts
    const parts = insights.split('**').filter(part => part.trim())
    const carouselItems = []

    // Process parts in pairs (title, content)
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i + 1]) {
        const rawTitle = parts[i].trim()
        const content = parts[i + 1].trim()

        // Extract emoji and clean title, then map to icons.
        // Use alternation (not a character class) because ⚠️ is two codepoints
        // (U+26A0 + U+FE0F variation selector); putting it inside [...] triggers
        // no-misleading-character-class and matches incorrectly without the /u flag.
        const emojiMatch = rawTitle.match(/🎯|✅|⚠️|💡|⭐/u)?.[0] || '💡'
        const cleanTitle = rawTitle.replace(/🎯|✅|⚠️|💡|⭐/gu, '').trim().replace(/^:/, '').trim()

        // Map emojis to Lucide icons
        let iconComponent = Target // default
        let iconColor = 'text-blue-500'

        if (emojiMatch === '🎯' || cleanTitle.toLowerCase().includes('focus')) {
          iconComponent = Target
          iconColor = 'text-blue-500'
        } else if (emojiMatch === '✅' || cleanTitle.toLowerCase().includes('low effort') || cleanTitle.toLowerCase().includes('take off')) {
          iconComponent = CheckCircle2
          iconColor = 'text-green-500'
        } else if (emojiMatch === '⚠️' || cleanTitle.toLowerCase().includes('urgent') || cleanTitle.toLowerCase().includes('really urgent')) {
          iconComponent = AlertCircle
          iconColor = 'text-destructive'
        }

        if (cleanTitle && content) {
          carouselItems.push({
            emoji: emojiMatch,
            iconComponent: iconComponent,
            iconColor: iconColor,
            title: cleanTitle,
            content: content
          })
        }
      }
    }

    // If parsing failed, create a fallback item
    if (carouselItems.length === 0) {
      carouselItems.push({
        emoji: '💡',
        iconComponent: Target,
        iconColor: 'text-blue-500',
        title: 'AI Recommendations',
        content: insights
      })
    }

    return carouselItems
  }


  // Auto-generate insights when tasks are available and no valid cache exists
  useEffect(() => {
    const shouldGenerate =
      analytics.total > 0 && // Has tasks
      !loadingInsights && // Not already loading
      !aiInsights && // No insights currently displayed
      !insightsCacheValid // No valid cache

    if (shouldGenerate) {
      handleGenerateInsights()
    }
  }, [analytics.total, aiInsights, insightsCacheValid, loadingInsights])

  const handleGenerateInsights = async() => {
    // Don't regenerate if already loading or if we have valid cached insights
    if (loadingInsights || (insightsCacheValid && aiInsights)) {
      return
    }

    setLoadingInsights(true)
    try {
      const insights = await openaiService.generateAnalyticsInsights(analytics)
      const timestamp = Date.now()

      setAiInsights(insights)
      setInsightsCacheTime(timestamp)
      setLastTaskCount(analytics.total)

      // Save to server (with localStorage fallback)
      try {
        await apiService.saveAnalyticsInsights(selectedProjectId, insights, analytics.total)
      } catch (error) {
        console.error('[Analytics] Failed to cache insights:', error)
      }
    } catch (error) {
      console.error('[Analytics] Failed to generate insights:', error)
      setAiInsights('Failed to generate insights. Please check your AI provider configuration and try again.')
    } finally {
      setLoadingInsights(false)
    }
  }

  // Load cached insights when project changes
  useEffect(() => {
    const loadInsights = async() => {
      // Reset state
      setAiInsights(null)
      setInsightsCacheTime(null)
      setLastTaskCount(0)

      // Try to load cached insights for this specific project
      try {
        const foundCache = await loadCachedInsights(selectedProjectId)
        if (!foundCache) {
          console.log('[Analytics] No valid cache found for project:', selectedProjectId)
        }
      } catch (error) {
        console.error('[Analytics] Error loading cached insights:', error)
      }
    }

    loadInsights()
  }, [selectedProjectId])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isFilterOpen && !event.target.closest('.analytics-filter-dropdown')) {
        setIsFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterOpen])

  return (
    <>
      {/* Custom Swiper styles */}
      <style jsx global>{`
        .insights-swiper .swiper-pagination {
          bottom: -20px !important;
          position: relative !important;
        }
        .insights-swiper .swiper-pagination-bullet {
          width: 4px !important;
          height: 4px !important;
          background: rgb(156 163 175) !important;
          opacity: 1 !important;
          margin: 0 2px !important;
        }
        .insights-swiper .swiper-pagination-bullet-active {
          background: rgb(147 51 234) !important;
        }
        .dark .insights-swiper .swiper-pagination-bullet {
          background: rgb(75 85 99) !important;
        }
      `}
      </style>

      <div className="space-y-6 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-row items-start justify-between gap-2"
        >
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="font-serif-display text-3xl sm:text-4xl text-foreground">
              Analytics Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
              {selectedProjectId === 'all'
                ? `${projects.length} projects`
                : projects.find(p => p.id === selectedProjectId)?.name || 'Selected project'}
            </p>
          </div>

          {/* Project Filter */}
          <div className="relative analytics-filter-dropdown">
            <Button
              variant="outline"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1 px-2 sm:px-3"
              size="sm"
            >
              <Filter className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm truncate max-w-24 sm:max-w-none">
                {selectedProjectId === 'all'
                  ? 'All Projects'
                  : projects.find(p => p.id === selectedProjectId)?.name || 'Selected'}
              </span>
            </Button>

            <AnimatePresence>
              {isFilterOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFilterOpen(false)}
                  />

                  {/* Dropdown */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-72 bg-card rounded-lg shadow-xl border border-border overflow-hidden z-50"
                  >
                    {/* All Projects Option */}
                    <button
                      onClick={() => {
                        setSelectedProjectId('all')
                        setIsFilterOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-secondary transition-colors border-b border-border ${
                        selectedProjectId === 'all' ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                    >
                      <div className="font-medium">All Projects</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        View analytics across all {projects.length} projects
                      </div>
                    </button>

                    {/* Individual Projects */}
                    {projects.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted">
                          Individual Projects
                        </div>
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => {
                              setSelectedProjectId(project.id)
                              setIsFilterOpen(false)
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-secondary transition-colors ${
                              selectedProjectId === project.id ? 'bg-primary/10 text-primary font-medium' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{project.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {project.tasks?.length || 0} tasks
                              </span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* AI Task Recommendations - Moved to Top */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="relative overflow-hidden bg-card border border-border shadow-sm">
            {/* No animated background — v3 stays quiet, accent border on header carries hierarchy */}

            <CardHeader className="border-b border-border bg-card">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/30 rounded-md text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-serif-display text-2xl text-foreground">
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
                      <Sparkles className="relative h-12 w-12 mx-auto text-muted-foreground/60" />
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
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Sparkles className="relative h-12 w-12 mx-auto text-primary" />
                      </motion.div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Analyzing Your Tasks</h3>
                    <p className="text-sm text-muted-foreground">
                      Our AI is reviewing your {analytics.total} tasks to generate personalized insights...
                    </p>
                  </motion.div>
                </div>
              ) : aiInsights ? (
                (() => {
                  const carouselItems = parseInsightsIntoCarousel(aiInsights)

                  return (
                    <div className="space-y-4 pb-6">
                      {/* SwiperJS Carousel */}
                      <Swiper
                        modules={[Navigation, Pagination, Autoplay, EffectFade]}
                        spaceBetween={20}
                        slidesPerView={1}
                        autoplay={{
                          delay: 4000,
                          disableOnInteraction: false,
                          pauseOnMouseEnter: true
                        }}
                        pagination={{
                          clickable: false,
                          bulletClass: 'swiper-pagination-bullet !w-1 !h-1 !bg-purple-500',
                          bulletActiveClass: 'swiper-pagination-bullet-active !bg-purple-600'
                        }}
                        effect="fade"
                        fadeEffect={{
                          crossFade: true
                        }}
                        loop={carouselItems.length > 1}
                        className="insights-swiper"
                        style={{
                          '--swiper-pagination-bottom': '0px',
                          '--swiper-pagination-bullet-size': '4px',
                          '--swiper-pagination-bullet-horizontal-gap': '2px'
                        }}
                      >
                        {carouselItems.map((item, index) => (
                          <SwiperSlide key={index}>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                              className="bg-card border border-border rounded-md p-6"
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                  <div className={`p-2 rounded-full bg-card ${item.iconColor}`}>
                                    <item.iconComponent className="h-6 w-6" />
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold mb-3 text-purple-700 dark:text-purple-300">
                                    {item.title}
                                  </h3>
                                  <p className="text-foreground leading-relaxed">
                                    {item.content}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    </div>
                  )
                })()
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No insights available yet.</p>
                </div>
              )}

              {insightsCacheValid && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-card rounded-full px-4 py-2 border border-border"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Insights refresh daily at midnight or when you add new tasks</span>
                </motion.div>
              )}
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
                <div className="text-3xl font-emphasis text-success tabular-nums">
                  {analytics.completionRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.completed} of {analytics.total} tasks completed
                </p>
                {/* Progress bar */}
                <div className="w-full h-2 bg-secondary rounded-full mt-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-success"
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
                <div className="text-3xl font-emphasis tabular-nums">{analytics.total}</div>
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
                <div className="text-3xl font-emphasis text-info tabular-nums">
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
                <div className={`text-3xl font-emphasis tabular-nums ${analytics.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
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
                <div className="text-center p-4 rounded-lg bg-muted">
                  <div className="text-2xl font-emphasis text-foreground">{analytics.todo}</div>
                  <div className="text-xs text-muted-foreground mt-1">To Do</div>
                </div>

                {/* In Progress */}
                <div className="text-center p-4 rounded-lg bg-info/15 dark:bg-blue-900/30">
                  <div className="text-2xl font-emphasis text-info">{analytics.inProgress}</div>
                  <div className="text-xs text-muted-foreground mt-1">In Progress</div>
                </div>

                {/* Blocked */}
                <div className="text-center p-4 rounded-lg bg-destructive/15">
                  <div className="text-2xl font-emphasis text-destructive">{analytics.blocked}</div>
                  <div className="text-xs text-muted-foreground mt-1">Blocked</div>
                </div>

                {/* Done */}
                <div className="text-center p-4 rounded-lg bg-success/15">
                  <div className="text-2xl font-emphasis text-success">{analytics.completed}</div>
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
                <div className="text-center p-4 rounded-lg bg-destructive/15">
                  <div className="text-2xl font-emphasis text-destructive">{analytics.highPriority}</div>
                  <div className="text-xs text-muted-foreground mt-1">High Priority</div>
                </div>

                {/* Medium Priority */}
                <div className="text-center p-4 rounded-lg bg-warning/15 dark:bg-yellow-900/30">
                  <div className="text-2xl font-emphasis text-warning dark:text-warning">{analytics.mediumPriority}</div>
                  <div className="text-xs text-muted-foreground mt-1">Medium Priority</div>
                </div>

                {/* Low Priority */}
                <div className="text-center p-4 rounded-lg bg-success/15">
                  <div className="text-2xl font-emphasis text-success">{analytics.lowPriority}</div>
                  <div className="text-xs text-muted-foreground mt-1">Low Priority</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </>
  )
}
