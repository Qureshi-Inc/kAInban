import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Square, X } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { formatTime } from '../lib/utils'
import useAppStore from '../stores/useAppStore'
import audioService from '../services/audioService'
import openaiService from '../services/openaiService'

export default function RecordingModal() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const timerRef = useRef(null)

  const {
    isRecordingModalOpen,
    setRecordingModalOpen,
    isRecording,
    setRecording,
    recordingTime,
    setRecordingTime,
    setTranscript,
    setSummary,
    addTask,
    addNotification,
    setUploadProgress,
    resetUploadProgress
  } = useAppStore()

  useEffect(() => {
    if (isRecording && isRecordingModalOpen) {
      startTimer()
      startVisualization()
    } else {
      stopTimer()
      stopVisualization()
    }

    return () => {
      stopTimer()
      stopVisualization()
    }
  }, [isRecording, isRecordingModalOpen])

  const startTimer = () => {
    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setRecordingTime(elapsed)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRecordingTime(0)
  }

  const startVisualization = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const { width, height } = canvas

    const draw = () => {
      const dataArray = audioService.getVisualizationData()

      if (!dataArray) {
        // Draw a simple pulse animation when no data is available
        ctx.fillStyle = '#f8f9fa'
        ctx.fillRect(0, 0, width, height)

        const time = Date.now() * 0.005
        const centerY = height / 2
        const barCount = 32

        for (let i = 0; i < barCount; i++) {
          const x = (i / barCount) * width
          const barHeight = Math.sin(time + i * 0.5) * 20 + 10
          const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight)
          gradient.addColorStop(0, '#4285f4')
          gradient.addColorStop(1, '#34a853')

          ctx.fillStyle = gradient
          ctx.fillRect(x, centerY - barHeight, width / barCount - 2, barHeight * 2)
        }
      } else {
        // Draw actual audio data
        ctx.fillStyle = '#f8f9fa'
        ctx.fillRect(0, 0, width, height)

        const barWidth = (width / dataArray.length) * 2.5
        let x = 0

        for (let i = 0; i < dataArray.length; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8

          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
          gradient.addColorStop(0, '#4285f4')
          gradient.addColorStop(1, '#34a853')

          ctx.fillStyle = gradient
          ctx.fillRect(x, height - barHeight, barWidth, barHeight)

          x += barWidth + 1
        }
      }

      if (isRecording) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }

    draw()
  }

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  const handleStop = async () => {
    try {
      console.log('[RecordingModal] Stopping recording...')
      const audioBlob = await audioService.stopRecording()

      setRecording(false)
      setRecordingModalOpen(false)

      if (audioBlob.size === 0) {
        throw new Error('Recording failed: No audio data captured')
      }

      // Start progress tracking
      setUploadProgress({
        stage: 'uploading',
        percentage: 0,
        message: 'Processing recording...'
      })

      addNotification({
        type: 'info',
        message: 'Processing recording...'
      })

      // Transcribe with Azure
      setUploadProgress({
        stage: 'transcribing',
        percentage: 50,
        message: 'Transcribing audio with Azure AI...'
      })

      const transcript = await openaiService.transcribeAudio(audioBlob)
      setTranscript(transcript)

      addNotification({
        type: 'success',
        message: 'Audio transcribed successfully!'
      })

      // Auto-generate tasks with existing context
      try {
        setUploadProgress({
          stage: 'extracting',
          percentage: 75,
          message: 'Extracting tasks from transcript...'
        })

        const { tasks: existingTasks, addTask, updateTask } = useAppStore.getState()

        console.log('[TaskUpdate] ===== TASK EXTRACTION START =====')
        console.log('[TaskUpdate] Existing tasks count:', existingTasks.length)
        console.log('[TaskUpdate] Existing tasks:', existingTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority
        })))

        const extractedTasks = await openaiService.extractTasks(transcript, existingTasks)

        console.log('[TaskUpdate] Extracted tasks from AI:', extractedTasks)
        console.log('[TaskUpdate] AI returned', extractedTasks.length, 'task(s)')

        let newCount = 0
        let updatedCount = 0

        extractedTasks.forEach((task, index) => {
          console.log(`[TaskUpdate] Processing task ${index + 1}/${extractedTasks.length}:`, task)

          if (task.matchId && task.matchId > 0) {
            // Update existing task
            const existingTask = existingTasks[task.matchId - 1]

            if (existingTask) {
              console.log('[TaskUpdate] ✓ MATCHED existing task')
              console.log('[TaskUpdate] Existing task ID:', existingTask.id)
              console.log('[TaskUpdate] Existing task title:', existingTask.title)
              console.log('[TaskUpdate] Current status:', existingTask.status)
              console.log('[TaskUpdate] Current description:', existingTask.description)

              const updatedDescription = existingTask.description +
                (task.updates ? `\n\n**Update**: ${task.updates}` : '')

              const updates = {
                description: updatedDescription,
                status: task.newStatus || existingTask.status,
                priority: task.newPriority || existingTask.priority,
                assignee: task.assignee || existingTask.assignee
              }

              console.log('[TaskUpdate] Applying updates:', updates)

              updateTask(existingTask.id, updates)

              console.log('[TaskUpdate] ✓ Task updated successfully')
              console.log('[TaskUpdate] New status:', updates.status)
              console.log('[TaskUpdate] New priority:', updates.priority)

              updatedCount++
            } else {
              console.error('[TaskUpdate] ✗ MATCH ID', task.matchId, 'not found in existing tasks!')
            }
          } else {
            // Create new task
            console.log('[TaskUpdate] ⊕ CREATING NEW task')
            console.log('[TaskUpdate] Title:', task.title)
            console.log('[TaskUpdate] Description:', task.description)
            console.log('[TaskUpdate] Priority:', task.priority)
            console.log('[TaskUpdate] Status:', task.status || 'todo')

            addTask(task)
            newCount++

            console.log('[TaskUpdate] ✓ New task created')
          }
        })

        console.log('[TaskUpdate] ===== TASK EXTRACTION COMPLETE =====')
        console.log('[TaskUpdate] New tasks created:', newCount)
        console.log('[TaskUpdate] Existing tasks updated:', updatedCount)
        console.log('[TaskUpdate] Total tasks in project after updates:', useAppStore.getState().tasks.length)

        if (newCount > 0 || updatedCount > 0) {
          const messages = []
          if (newCount > 0) messages.push(`${newCount} new`)
          if (updatedCount > 0) messages.push(`${updatedCount} updated`)

          addNotification({
            type: 'success',
            message: `Tasks: ${messages.join(', ')}!`
          })
        } else {
          console.log('[TaskUpdate] No new or updated tasks')
        }
      } catch (error) {
        console.error('[TaskUpdate] ✗ ERROR during task extraction:', error)
        console.error('[TaskUpdate] Error stack:', error.stack)
      }

      // Auto-generate summary
      try {
        const summary = await openaiService.generateSummary(transcript)
        setSummary(summary)
        addNotification({
          type: 'success',
          message: 'Summary generated!'
        })
      } catch (error) {
        console.error('[RecordingModal] Summary error:', error)
      }

      // Mark as complete
      setUploadProgress({
        stage: 'complete',
        percentage: 100,
        message: 'All done!'
      })

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        resetUploadProgress()
      }, 3000)
    } catch (error) {
      console.error('[RecordingModal] Stop recording error:', error)
      setRecording(false)
      setRecordingModalOpen(false)

      // Show error in progress indicator
      setUploadProgress({
        stage: 'error',
        percentage: 0,
        message: 'Processing failed',
        error: error.message || 'Failed to process recording'
      })

      addNotification({
        type: 'error',
        message: error.message || 'Failed to process recording'
      })

      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        resetUploadProgress()
      }, 5000)
    }
  }

  const handleClose = () => {
    if (isRecording) {
      handleStop()
    } else {
      setRecordingModalOpen(false)
    }
  }

  return (
    <Dialog open={isRecordingModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Recording Audio
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Audio Visualization */}
          <div className="recording-visualizer p-4 rounded-lg">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              className="w-full h-[120px] rounded-md"
            />
          </div>

          {/* Recording Info */}
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-2xl font-mono font-bold text-primary"
            >
              {formatTime(recordingTime)}
            </motion.div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <motion.div
                className="w-2 h-2 bg-red-500 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              Recording in progress...
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center">
            <Button
              onClick={handleStop}
              variant="destructive"
              size="lg"
              className="flex items-center gap-2 min-w-[150px]"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}