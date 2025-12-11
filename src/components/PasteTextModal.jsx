import { motion } from 'framer-motion'
import { FileText, X, Sparkles } from 'lucide-react'
import React, { useState } from 'react'
import apiService from '../services/apiService'
import openaiService from '../services/openaiService'
import useAppStore from '../stores/useAppStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

export default function PasteTextModal({ open, onOpenChange }) {
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const {
    currentProject,
    createMeeting,
    addTask,
    addNotification,
    setUploadProgress,
    resetUploadProgress
  } = useAppStore()

  const handleProcess = async() => {
    if (!transcript.trim()) {
      addNotification({
        type: 'error',
        message: 'Please paste some text first'
      })
      return
    }

    if (!currentProject) {
      addNotification({
        type: 'error',
        message: 'Please select a project first'
      })
      return
    }

    setIsProcessing(true)

    // Close modal immediately so progress UI is visible
    onOpenChange(false)

    try {
      // Start progress tracking
      setUploadProgress({
        stage: 'converting',
        percentage: 10,
        message: 'Processing pasted text...'
      })

      // Generate summary from the pasted text
      setUploadProgress({
        stage: 'transcribing',
        percentage: 30,
        message: 'Generating summary with AI...'
      })

      const summary = await openaiService.generateSummary(transcript)
      console.log('[PasteText] Summary generated:', summary)

      // Create meeting with the transcript and summary
      setUploadProgress({
        stage: 'transcribing',
        percentage: 60,
        message: 'Creating meeting record...'
      })

      const meetingName = `Pasted Text - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
      await createMeeting(meetingName, transcript, summary)

      // Extract tasks from the pasted text
      setUploadProgress({
        stage: 'extracting',
        percentage: 80,
        message: 'Extracting tasks from text...'
      })

      const { tasks: existingTasks, updateTask: storeUpdateTask } = useAppStore.getState()
      const tasks = await openaiService.extractTasks(transcript, existingTasks)

      let newCount = 0
      let updatedCount = 0

      // Add extracted tasks
      if (tasks && tasks.length > 0) {
        tasks.forEach(async task => {
          if (task.matchId && task.matchId > 0) {
            // Update existing task and add AI comment instead of updating description
            const existingTask = existingTasks[task.matchId - 1]
            if (existingTask) {
              // Update task properties (status, priority, etc.) but not description
              storeUpdateTask(existingTask.id, {
                status: task.newStatus || existingTask.status,
                priority: task.newPriority || existingTask.priority,
                assignee: task.assignee || existingTask.assignee
              })

              // Add AI comment with the updates instead of appending to description
              if (task.updates) {
                try {
                  await apiService.addTaskComment(
                    existingTask.id,
                    `**AI Analysis Update from Transcript**: ${task.updates}`,
                    'ai_update',
                    {
                      source: 'transcript_analysis',
                      originalTranscript: transcript.substring(0, 200) + '...' // First 200 chars for context
                    }
                  )
                } catch (error) {
                  console.error('Failed to add AI comment:', error)
                }
              }
              updatedCount++
            }
          } else {
            // Create new task
            addTask({
              title: task.title,
              description: task.description || '',
              priority: task.priority || 'medium',
              status: 'todo'
            })
            newCount++
          }
        })

        // Show success notification
        const messages = []
        if (newCount > 0) {messages.push(`${newCount} new`)}
        if (updatedCount > 0) {messages.push(`${updatedCount} updated`)}

        addNotification({
          type: 'success',
          message: `Tasks: ${messages.join(', ')}!`
        })
      }

      // Mark as complete
      setUploadProgress({
        stage: 'complete',
        percentage: 100,
        message: 'Text processing complete!'
      })

      // Clear transcript (modal already closed)
      setTranscript('')

      // Auto-dismiss progress after 3 seconds
      setTimeout(() => {
        resetUploadProgress()
      }, 3000)

    } catch (error) {
      console.error('[PasteText] Error:', error)

      // Show error in progress indicator
      setUploadProgress({
        stage: 'error',
        percentage: 0,
        message: 'Text processing failed',
        error: error.message || 'Failed to process pasted text'
      })

      addNotification({
        type: 'error',
        message: `Failed to process text: ${error.message}`
      })

      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        resetUploadProgress()
      }, 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setTranscript('')
    onOpenChange(false)
    // Reset progress if user cancels
    resetUploadProgress()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Paste Your Transcript
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Paste your meeting notes, transcript, or any text containing tasks. AI will extract action items automatically.
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your transcript here...

Example:
- We need to update the user authentication system
- Schedule a meeting with the design team next week
- Review the Q4 budget proposal
- Fix the bug in the payment processing module"
            className="w-full h-64 px-4 py-3 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
            disabled={isProcessing}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{transcript.length} characters</span>
            {transcript.length > 0 && (
              <span>~{Math.ceil(transcript.split(/\s+/).length / 1)} words</span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !transcript.trim() || !currentProject}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Extract Tasks
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
