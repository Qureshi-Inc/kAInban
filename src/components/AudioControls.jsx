import React, { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Upload, Square, Pause, Play, FileText } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { formatTime } from '../lib/utils'
import useAppStore from '../stores/useAppStore'
import audioService from '../services/audioService'
import openaiService from '../services/openaiService'
import transcriptionQueue from '../services/transcriptionQueue'
import PasteTextModal from './PasteTextModal'
import AudioVisualizer from './AudioVisualizer'

export default function AudioControls() {
  const fileInputRef = useRef(null)
  const timerRef = useRef(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [chunkInfo, setChunkInfo] = useState(null)
  const [isPasteTextOpen, setIsPasteTextOpen] = useState(false)
  const [audioStream, setAudioStream] = useState(null)
  const [transcriptionStatus, setTranscriptionStatus] = useState({
    transcribedChunks: 0,
    totalChunks: 0,
    processing: false
  })

  const {
    isRecording,
    isPaused,
    setRecording,
    setPaused,
    setRecordingModalOpen,
    createMeeting,
    addTask,
    addNotification,
    currentProject,
    setUploadProgress,
    resetUploadProgress
  } = useAppStore()

  // Timer effects
  useEffect(() => {
    if (isRecording) {
      startTimer()
    } else {
      stopTimer()
      setRecordingTime(0)
    }

    return () => {
      stopTimer()
    }
  }, [isRecording])

  const startTimer = () => {
    const startTime = Date.now()
    let pauseOffset = 0
    let lastPauseTime = null

    timerRef.current = setInterval(() => {
      // Check if recording is paused by checking the audioService state
      const currentlyPaused = audioService.isPaused()

      if (currentlyPaused) {
        // Don't update timer while paused, but track pause time
        if (!lastPauseTime) {
          lastPauseTime = Date.now()
          console.log('[AudioControls] Timer paused at:', lastPauseTime)
        }
        return
      }

      // If resuming from pause, add pause duration to offset
      if (lastPauseTime) {
        const pauseDuration = Date.now() - lastPauseTime
        pauseOffset += pauseDuration
        console.log('[AudioControls] Timer resumed, pause duration:', pauseDuration)
        lastPauseTime = null
      }

      const elapsed = Math.floor((Date.now() - startTime - pauseOffset) / 1000)
      setRecordingTime(elapsed)

      // Update chunk info
      const info = audioService.getCurrentChunkInfo()
      if (info) {
        setChunkInfo(info)
      }
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setChunkInfo(null)
  }

  // Visualization is now handled by AudioVisualizer component

  const handleStartRecording = async () => {
    try {
      // Reset transcription queue for new recording
      transcriptionQueue.reset()
      setTranscriptionStatus({
        transcribedChunks: 0,
        totalChunks: 0,
        processing: false
      })

      // Set up transcription completion callback to update UI when transcription finishes
      transcriptionQueue.setOnTranscriptionComplete((chunkIndex, transcript, status) => {
        console.log(`[AudioControls] Chunk ${chunkIndex} transcription completed: ${transcript.length} chars`)

        // Update UI with current status
        setTranscriptionStatus(prevStatus => ({
          transcribedChunks: status.transcribed,
          totalChunks: Math.max(prevStatus.totalChunks, chunkIndex + 1),
          processing: status.processing || status.queued > 0
        }))
      })

      // Set up transcription error callback
      transcriptionQueue.setOnTranscriptionError((chunkIndex, error, status) => {
        console.error(`[AudioControls] Chunk ${chunkIndex} transcription failed:`, error)

        // Update UI to show error
        setTranscriptionStatus(prevStatus => ({
          transcribedChunks: status.transcribed,
          totalChunks: Math.max(prevStatus.totalChunks, chunkIndex + 1),
          processing: status.processing || status.queued > 0
        }))

        // Show notification
        addNotification({
          type: 'error',
          message: `Background transcription error for segment ${chunkIndex + 1}: ${error}`
        })
      })

      // Set up chunk completion callback for background transcription
      audioService.setOnChunkComplete(async (chunkBlob, chunkIndex) => {
        console.log(`[AudioControls] Chunk ${chunkIndex} completed, queuing for background transcription`)

        // Queue chunk for background transcription
        await transcriptionQueue.enqueueChunk(chunkBlob, chunkIndex)

        // Update total chunks immediately (transcribed count updates via completion callback)
        setTranscriptionStatus(prevStatus => ({
          ...prevStatus,
          totalChunks: chunkIndex + 1,
          processing: true
        }))

        console.log(`[AudioControls] Chunk ${chunkIndex} queued, total segments: ${chunkIndex + 1}`)
      })

      await audioService.startRecording()
      setRecording(true)
      setPaused(false)

      // Update audio stream state to trigger AudioVisualizer re-render
      setAudioStream(audioService.stream)
    } catch (error) {
      console.error('Recording error:', error)
      addNotification({
        type: 'error',
        message: error.message || 'Failed to start recording'
      })
    }
  }

  const handlePauseRecording = () => {
    try {
      audioService.pauseRecording()
      setPaused(true)
    } catch (error) {
      console.error('Pause recording error:', error)
      addNotification({
        type: 'error',
        message: error.message || 'Failed to pause recording'
      })
    }
  }

  const handleResumeRecording = () => {
    try {
      audioService.resumeRecording()
      setPaused(false)
    } catch (error) {
      console.error('Resume recording error:', error)
      addNotification({
        type: 'error',
        message: error.message || 'Failed to resume recording'
      })
    }
  }

  const handleStopRecording = async () => {
    try {
      console.log('[AudioControls] Stopping recording...')
      const result = await audioService.stopRecording()

      // Check if this is a chunked recording
      const isChunked = result.isChunked || false
      const audioBlob = isChunked ? null : result

      if (isChunked) {
        console.log('[AudioControls] Chunked recording detected:', {
          chunks: result.chunks.length,
          totalSize: result.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
        })
      } else {
        console.log('[AudioControls] Single recording:', {
          size: audioBlob.size,
          type: audioBlob.type
        })

        if (audioBlob.size === 0) {
          throw new Error('Recording failed: No audio data captured')
        }
      }

      setRecording(false)
      setPaused(false)
      setRecordingModalOpen(false)
      setAudioStream(null) // Reset audio stream when recording stops

      // Start progress tracking
      setUploadProgress({
        stage: 'converting',
        percentage: 25,
        message: 'Processing recording...'
      })

      console.log('[AudioControls] Current settings:', {
        hasEndpoint: !!useAppStore.getState().settings.azureEndpoint,
        hasApiKey: !!useAppStore.getState().settings.apiKey
      })

      // Transcribe the audio (handles both single and chunked)
      let transcript = ''

      if (isChunked) {

        // Get transcripts that were already processed in the background
        const cachedTranscripts = transcriptionQueue.getAllTranscripts()

        // Array to store all transcripts
        const transcripts = [...cachedTranscripts]

        // Check if there are any remaining chunks that weren't transcribed yet
        const remainingChunks = result.chunks.slice(cachedTranscripts.length)

        if (remainingChunks.length > 0) {
          console.log(`[AudioControls] Transcribing ${remainingChunks.length} remaining chunks...`)

          for (let i = 0; i < remainingChunks.length; i++) {
            const actualIndex = cachedTranscripts.length + i
            const progressPercent = 25 + Math.floor(((actualIndex + 1) / result.chunks.length) * 50)
            const progressMsg = `Transcribing final part ${actualIndex + 1} of ${result.chunks.length}...`

            setUploadProgress({
              stage: 'transcribing',
              percentage: progressPercent,
              message: progressMsg
            })

            console.log(`[AudioControls] Transcribing chunk ${actualIndex + 1}/${result.chunks.length}`)

            // WebM chunks from recording can be sent directly to Azure Whisper
            // No need to convert to WAV (Azure supports WebM)
            console.log(`[AudioControls] Transcribing WebM chunk ${actualIndex + 1} directly...`)
            const chunkTranscript = await openaiService.transcribeAudio(remainingChunks[i])
            transcripts.push(chunkTranscript)
            console.log(`[AudioControls] Chunk ${actualIndex + 1} transcribed: ${chunkTranscript.length} chars`)
          }
        } else {
          console.log(`[AudioControls] All chunks were already transcribed in the background!`)
        }

        // Combine all transcripts
        transcript = transcripts.join(' ')
      } else {
        // Single chunk transcription
        setUploadProgress({
          stage: 'transcribing',
          percentage: 50,
          message: 'Transcribing audio with Azure AI...'
        })

        transcript = await openaiService.transcribeAudio(audioBlob)
      }

      console.log('[AudioControls] Transcript received:', {
        length: transcript.length,
        preview: transcript.substring(0, 100)
      })

      // Auto-generate summary from transcript
      console.log('[AudioControls] Auto-generating summary...')
      let generatedSummary = ''
      try {
        generatedSummary = await openaiService.generateSummary(transcript)
        console.log('[AudioControls] Summary received:', generatedSummary?.length || 0, 'characters')

        // Create meeting file
        const meetingName = `Recording - ${new Date().toLocaleDateString()}`
        await createMeeting(meetingName, transcript, generatedSummary)
      } catch (summaryError) {
        console.error('[AudioControls] Summary generation error:', summaryError)
        addNotification({
          type: 'error',
          message: `Summary generation failed: ${summaryError.message}`
        })
        return // Exit if summary fails, since we need it for task extraction
      }

      // Auto-generate tasks from TRANSCRIPT (not summary) with existing context
      try {
        setUploadProgress({
          stage: 'extracting',
          percentage: 75,
          message: 'Extracting tasks from transcript...'
        })

        const { tasks: existingTasks, updateTask: storeUpdateTask } = useAppStore.getState()
        const extractedTasks = await openaiService.extractTasks(transcript, existingTasks)

        let newCount = 0
        let updatedCount = 0

        if (extractedTasks.length > 0) {
          extractedTasks.forEach(task => {
            if (task.matchId && task.matchId > 0) {
              // Update existing task
              const existingTask = existingTasks[task.matchId - 1]
              if (existingTask) {
                const updatedDescription = existingTask.description +
                  (task.updates ? `\n\n**Update**: ${task.updates}` : '')

                storeUpdateTask(existingTask.id, {
                  description: updatedDescription,
                  status: task.newStatus || existingTask.status,
                  priority: task.newPriority || existingTask.priority,
                  assignee: task.assignee || existingTask.assignee
                })
                updatedCount++
              }
            } else {
              // Create new task
              addTask(task)
              newCount++
            }
          })

          const messages = []
          if (newCount > 0) messages.push(`${newCount} new`)
          if (updatedCount > 0) messages.push(`${updatedCount} updated`)

          // Only show notification with final result
          addNotification({
            type: 'success',
            message: `Tasks: ${messages.join(', ')}!`
          })
        } else {
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
      } catch (taskError) {
        console.error('[AudioControls] Task extraction error:', taskError)

        // Show error in progress indicator
        setUploadProgress({
          stage: 'error',
          percentage: 0,
          message: 'Task extraction failed',
          error: taskError.message || 'Failed to extract tasks'
        })

        addNotification({
          type: 'error',
          message: `Task extraction failed: ${taskError.message}`
        })

        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          resetUploadProgress()
        }, 5000)
      }
    } catch (error) {
      console.error('[AudioControls] Stop recording error:', {
        message: error.message,
        stack: error.stack,
        error: error
      })
      setRecording(false)
      setPaused(false)
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Start progress tracking
      setUploadProgress({
        stage: 'uploading',
        percentage: 0,
        message: `Uploading ${file.name}...`
      })

      // Process the file (may include conversion)
      setUploadProgress({
        stage: 'converting',
        percentage: 25,
        message: 'Converting audio format...'
      })

      const processedFile = await audioService.processAudioFile(file)

      // Transcribe with Azure
      setUploadProgress({
        stage: 'transcribing',
        percentage: 50,
        message: 'Transcribing audio with Azure AI...'
      })

      // Pass progress callback for chunked transcription
      const transcript = await openaiService.transcribeAudio(processedFile, (progress) => {
        setUploadProgress(progress)
      })

      // Auto-generate summary from transcript
      let generatedSummary = ''
      try {
        generatedSummary = await openaiService.generateSummary(transcript)
        console.log('[AudioControls] Summary received:', generatedSummary?.length || 0, 'characters')

        // Create meeting file
        const meetingName = `${file.name} - ${new Date().toLocaleDateString()}`
        await createMeeting(meetingName, transcript, generatedSummary)
      } catch (summaryError) {
        console.error('[AudioControls] Summary generation error:', summaryError)
        addNotification({
          type: 'error',
          message: `Summary generation failed: ${summaryError.message}`
        })
        // Continue even if summary fails, mark as complete
        setUploadProgress({
          stage: 'complete',
          percentage: 100,
          message: 'Transcription complete!'
        })
        setTimeout(() => {
          resetUploadProgress()
        }, 3000)
        return
      }

      // Auto-generate tasks from TRANSCRIPT (not summary) with existing context
      let newCount = 0
      let updatedCount = 0

      try {
        setUploadProgress({
          stage: 'extracting',
          percentage: 75,
          message: 'Extracting tasks from transcript...'
        })

        const { tasks: existingTasks, updateTask: storeUpdateTask } = useAppStore.getState()
        const extractedTasks = await openaiService.extractTasks(transcript, existingTasks)

        if (extractedTasks.length > 0) {
          extractedTasks.forEach(task => {
            if (task.matchId && task.matchId > 0) {
              // Update existing task
              const existingTask = existingTasks[task.matchId - 1]
              if (existingTask) {
                const updatedDescription = existingTask.description +
                  (task.updates ? `\n\n**Update**: ${task.updates}` : '')

                storeUpdateTask(existingTask.id, {
                  description: updatedDescription,
                  status: task.newStatus || existingTask.status,
                  priority: task.newPriority || existingTask.priority,
                  assignee: task.assignee || existingTask.assignee
                })
                updatedCount++
              }
            } else {
              // Create new task
              addTask(task)
              newCount++
            }
          })

          const messages = []
          if (newCount > 0) messages.push(`${newCount} new`)
          if (updatedCount > 0) messages.push(`${updatedCount} updated`)

          // Only show final result notification
          addNotification({
            type: 'success',
            message: `Tasks: ${messages.join(', ')}!`
          })
        }
      } catch (taskError) {
        console.error('[AudioControls] Task extraction error:', taskError)

        addNotification({
          type: 'error',
          message: `Task extraction failed: ${taskError.message}`
        })
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
      console.error('File upload error:', error)

      // Show error in progress indicator
      setUploadProgress({
        stage: 'error',
        percentage: 0,
        message: 'Processing failed',
        error: error.message || 'Failed to process audio file'
      })

      addNotification({
        type: 'error',
        message: error.message || 'Failed to process audio file'
      })

      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        resetUploadProgress()
      }, 5000)
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Button controls - responsive layout */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                className="flex items-center justify-center gap-2 flex-1 sm:min-w-[160px] h-12 sm:h-10"
                disabled={!currentProject}
              >
                {isRecording ? (
                  <>
                    <Square className="h-5 w-5" />
                    <span className="text-sm sm:text-base">Stop Recording</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span className="text-sm sm:text-base">Start Recording</span>
                  </>
                )}
              </Button>

              {isRecording && (
                <Button
                  onClick={isPaused ? handleResumeRecording : handlePauseRecording}
                  variant="secondary"
                  size="lg"
                  className="flex items-center justify-center gap-2 flex-1 sm:min-w-[160px] h-12 sm:h-10"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-5 w-5" />
                      <span className="text-sm sm:text-base">Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-5 w-5" />
                      <span className="text-sm sm:text-base">Pause</span>
                    </>
                  )}
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.m4a"
                onChange={handleFileUpload}
                className="hidden"
              />

              {!isRecording && (
                <>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="lg"
                    className="flex items-center justify-center gap-2 flex-1 sm:min-w-[160px] h-12 sm:h-10"
                    disabled={!currentProject}
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm sm:text-base">Upload Audio</span>
                  </Button>

                  <Button
                    onClick={() => setIsPasteTextOpen(true)}
                    variant="outline"
                    size="lg"
                    className="flex items-center justify-center gap-2 flex-1 sm:min-w-[160px] h-12 sm:h-10"
                    disabled={!currentProject}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-sm sm:text-base">Paste Text</span>
                  </Button>
                </>
              )}
            </div>

            <PasteTextModal
              open={isPasteTextOpen}
              onOpenChange={setIsPasteTextOpen}
            />

            {!currentProject && (
              <p className="text-sm text-muted-foreground text-center">
                Please create or select a project to start recording
              </p>
            )}

            {/* Inline Recording Visualization */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4 border-t">
                    {/* Audio Visualization */}
                    <div className="py-2">
                      <AudioVisualizer
                        stream={audioStream}
                        isActive={isRecording && !isPaused}
                      />
                    </div>

                    {/* Recording Info */}
                    <div className="text-center space-y-2">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="text-2xl sm:text-3xl font-mono font-bold text-primary"
                      >
                        {formatTime(recordingTime)}
                      </motion.div>

                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <motion.div
                          className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500'}`}
                          animate={isPaused ? {} : { opacity: [1, 0.3, 1] }}
                          transition={isPaused ? {} : { duration: 1.5, repeat: Infinity }}
                        />
                        {isPaused ? 'Recording paused' : 'Recording in progress...'}
                      </div>

                      {/* Chunk Information */}
                      {chunkInfo && chunkInfo.currentChunk > 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                        >
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                            📦 Long Recording Detected
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            Segment {chunkInfo.currentChunk} • Next split in {formatTime(chunkInfo.remainingInChunk)}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Recording will be automatically split every 10 minutes for optimal processing
                          </div>
                        </motion.div>
                      )}

                      {/* Real-time Transcription Status */}
                      {transcriptionStatus.totalChunks > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                        >
                          <div className="text-xs font-medium text-green-900 dark:text-green-100 mb-1">
                            ✓ Background Transcription Active
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-300">
                            {transcriptionStatus.transcribedChunks} of {transcriptionStatus.totalChunks} segments transcribed
                            {transcriptionStatus.processing && ' (processing...)'}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Segments are being transcribed in the background to speed up final processing
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}