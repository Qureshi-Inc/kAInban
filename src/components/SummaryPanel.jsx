import { motion } from 'framer-motion'
import { FileText, Download, Share2, Copy } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export default function SummaryPanel() {
  const { getSelectedMeeting, addTask, addNotification } = useAppStore()
  const selectedMeeting = getSelectedMeeting()
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  // Load summary content from backend when meeting changes
  useEffect(() => {
    const loadSummary = async() => {
      if (!selectedMeeting) {
        setSummary('')
        return
      }

      // If we have summary content already, use it
      if (selectedMeeting.summary && selectedMeeting.summary.trim()) {
        setSummary(selectedMeeting.summary)
        return
      }

      // Otherwise, load from backend file
      try {
        setLoading(true)
        const response = await fetch(`/api/meetings/${selectedMeeting.id}/summary`)

        if (response.ok) {
          const data = await response.json()
          setSummary(data.content || '')
        } else {
          console.warn('[SummaryPanel] Failed to load summary from backend')
          setSummary(selectedMeeting.summary || '')
        }
      } catch (error) {
        console.error('[SummaryPanel] Error loading summary:', error)
        setSummary(selectedMeeting.summary || '')
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [selectedMeeting?.id])

  const handleExportSummary = () => {
    if (!summary || !summary.trim()) {
      addNotification({
        type: 'error',
        message: 'No summary available to export'
      })
      return
    }

    const meetingName = selectedMeeting?.name || 'Meeting Summary'
    const timestamp = new Date().toLocaleString()
    const content = `# ${meetingName}\n\nGenerated: ${timestamp}\n\n---\n\n${summary}`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_summary.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    addNotification({
      type: 'success',
      message: 'Summary exported successfully'
    })
  }

  const handleCopySummary = async() => {
    if (!summary || !summary.trim()) {
      addNotification({
        type: 'error',
        message: 'No summary available to copy'
      })
      return
    }

    try {
      await navigator.clipboard.writeText(summary)
      addNotification({
        type: 'success',
        message: 'Summary copied to clipboard'
      })
    } catch (error) {
      console.error('[SummaryPanel] Copy failed:', error)
      addNotification({
        type: 'error',
        message: 'Failed to copy summary'
      })
    }
  }

  const handleShareSummary = async() => {
    if (!summary || !summary.trim()) {
      addNotification({
        type: 'error',
        message: 'No summary available to share'
      })
      return
    }

    const meetingName = selectedMeeting?.name || 'Meeting Summary'

    if (navigator.share) {
      try {
        await navigator.share({
          title: meetingName,
          text: summary
        })
        addNotification({
          type: 'success',
          message: 'Summary shared successfully'
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[SummaryPanel] Share failed:', error)
          // Fallback to copy
          handleCopySummary()
        }
      }
    } else {
      // Fallback to copy if Web Share API not available
      handleCopySummary()
    }
  }

  const handleGenerateTasks = async() => {

    // IMPORTANT: Use transcript (not summary) for accurate task extraction
    const transcript = selectedMeeting?.transcript
    console.log('[SummaryPanel] Transcript length:', transcript?.length || 0)
    console.log('[SummaryPanel] Summary length:', summary?.length || 0)

    if (!transcript || !transcript.trim()) {
      console.log('[SummaryPanel] No transcript available')
      addNotification({
        type: 'error',
        message: 'No transcript available to generate tasks from'
      })
      return
    }

    try {
      addNotification({
        type: 'info',
        message: 'Extracting tasks from transcript using specialized AI agent...'
      })

      const { tasks: existingTasks, updateTask: storeUpdateTask } = useAppStore.getState()
      const extractedTasks = await openaiService.extractTasks(transcript, existingTasks)

      if (extractedTasks.length === 0) {
        addNotification({
          type: 'info',
          message: 'No actionable tasks found in the summary'
        })
        return
      }

      let newCount = 0
      let updatedCount = 0

      // Process tasks (new or updates)
      extractedTasks.forEach(task => {
        if (task.matchId && task.matchId > 0) {
          // Update existing task
          const existingTask = existingTasks[task.matchId - 1]
          if (existingTask) {
            storeUpdateTask(existingTask.id, {
              status: task.newStatus || existingTask.status,
              priority: task.newPriority || existingTask.priority,
              assignee: task.assignee || existingTask.assignee
            })

            // Add AI comment if there are updates
            if (task.updates) {
              apiService.addTaskComment(
                existingTask.id,
                `**AI Analysis Update from Summary**: ${task.updates}`,
                'ai_update',
                {
                  source: 'summary_analysis'
                }
              ).catch(error => {
                console.error('Failed to add AI comment:', error)
              })
            }
            updatedCount++
          }
        } else {
          // Create new task
          addTask(task)
          newCount++
        }
      })

      const messages = []
      if (newCount > 0) {messages.push(`${newCount} new`)}
      if (updatedCount > 0) {messages.push(`${updatedCount} updated`)}

      addNotification({
        type: 'success',
        message: `Tasks: ${messages.join(', ')}!`
      })
    } catch (error) {
      console.error('[SummaryPanel] Task generation error:', error)
      addNotification({
        type: 'error',
        message: error.message || 'Failed to generate tasks'
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="border-2 shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10 border-b-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <motion.div
                className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <FileText className="h-5 w-5 text-white" />
              </motion.div>
              <span className="text-xl font-bold">Meeting Summary</span>
            </CardTitle>

            {summary && summary.trim() && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySummary}
                  className="h-8 px-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShareSummary}
                  className="h-8 px-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Share summary"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportSummary}
                  className="h-8 px-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Export as markdown file"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="min-h-[300px] max-h-[500px] overflow-y-auto rounded-lg bg-white/50 dark:bg-gray-900/50 p-4 border border-gray-200 dark:border-gray-700">
            {loading ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  </motion.div>
                  <p className="font-medium">Loading summary...</p>
                </motion.div>
              </div>
            ) : summary ? (
              <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed">
                <ReactMarkdown>
                  {summary}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">{selectedMeeting ? 'No summary available for this meeting' : 'Meeting summary will appear here...'}</p>
                  <p className="text-xs mt-2 opacity-60">Record or upload audio to generate a summary</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}