import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, X, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import useAppStore from '../stores/useAppStore'
import openaiService from '../services/openaiService'

export default function PasteTextModal({ open, onOpenChange }) {
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const {
    currentProject,
    createMeeting,
    addTask,
    addNotification
  } = useAppStore()

  const handleProcess = async () => {
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

    try {
      console.log('[PasteText] Processing transcript:', transcript.length, 'characters')

      // Generate summary and extract tasks from the pasted text
      addNotification({
        type: 'info',
        message: 'Processing your text...'
      })

      const summary = await openaiService.generateSummary(transcript)
      console.log('[PasteText] Summary generated:', summary)

      const tasks = await openaiService.extractTasks(transcript)
      console.log('[PasteText] Tasks extracted:', tasks.length)

      // Create a meeting with the transcript and summary
      const meetingName = `Pasted Text - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
      await createMeeting(meetingName, transcript, summary)

      // Add extracted tasks
      if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
          addTask({
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'medium',
            status: 'todo'
          })
        })

        addNotification({
          type: 'success',
          message: `✨ Extracted ${tasks.length} task${tasks.length > 1 ? 's' : ''} from your text`
        })
      } else {
        addNotification({
          type: 'info',
          message: 'No tasks found in the text'
        })
      }

      // Clear and close
      setTranscript('')
      onOpenChange(false)

    } catch (error) {
      console.error('[PasteText] Error:', error)
      addNotification({
        type: 'error',
        message: `Failed to process text: ${error.message}`
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setTranscript('')
    onOpenChange(false)
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
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
