class OpenAIService {
  constructor() {
    this.baseUrl = ''
    this.apiKey = ''
    this.apiVersion = '2024-06-01'  // Updated to latest stable version
    this.whisperDeployment = 'whisper-1'
    this.gptDeployment = 'gpt-4'
  }

  configure(settings) {
    this.baseUrl = settings.azureEndpoint?.replace(/\/$/, '') || ''
    this.apiKey = settings.apiKey || ''
    this.apiVersion = settings.apiVersion || '2024-06-01'  // Updated default
    this.whisperDeployment = settings.whisperDeployment || 'whisper-1'
    this.gptDeployment = settings.gptDeployment || 'gpt-4'

    console.log('[OpenAI] Configured:', {
      baseUrl: this.baseUrl ? '✓' : '✗',
      apiKey: this.apiKey ? '✓ (hidden)' : '✗',
      whisperDeployment: this.whisperDeployment,
      gptDeployment: this.gptDeployment
    })
  }

  validateConfig() {
    console.log('[OpenAI] Validating config...', {
      hasEndpoint: !!this.baseUrl,
      hasApiKey: !!this.apiKey
    })

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Azure OpenAI endpoint and API key are required. Please configure them in settings.')
    }
  }

  async transcribeAudio(audioBlob, progressCallback = null) {
    console.log('[OpenAI] Starting transcription...')
    this.validateConfig()

    try {
      // Check if this is a chunked audio object
      if (audioBlob.needsChunking) {
        console.log('[OpenAI] Large file detected - using chunked transcription')
        return await this.transcribeChunked(audioBlob, progressCallback)
      }

      const formData = new FormData()

      // Determine the correct filename and extension based on the blob type
      let filename = 'audio.webm'
      let processedBlob = audioBlob

      console.log('[OpenAI] Input blob type:', audioBlob.type || 'NO TYPE')
      console.log('[OpenAI] Input blob size:', audioBlob.size, 'bytes')
      console.log('[OpenAI] Input blob name:', audioBlob.name || 'NO NAME')

      // Check original filename if available (for uploaded files)
      if (audioBlob.name && audioBlob.name.toLowerCase().endsWith('.m4a')) {
        filename = 'audio.m4a'
        console.log('[OpenAI] Detected .m4a file by name')
      } else if (audioBlob.type.includes('m4a')) {
        filename = 'audio.m4a'
        console.log('[OpenAI] Detected m4a by MIME type')
      } else if (audioBlob.type.includes('mp3')) {
        filename = 'audio.mp3'
        console.log('[OpenAI] Detected mp3 by MIME type')
      } else if (audioBlob.type.includes('wav')) {
        filename = 'audio.wav'
        console.log('[OpenAI] Detected wav by MIME type')
      } else if (audioBlob.type.includes('ogg')) {
        filename = 'audio.ogg'
        console.log('[OpenAI] Detected ogg by MIME type')
      } else if (audioBlob.type.includes('mp4')) {
        filename = 'audio.mp4'
        console.log('[OpenAI] Detected mp4 by MIME type')
        // Clean codec specifications from MP4 MIME type (e.g., "audio/mp4;codecs=opus" -> "audio/mp4")
        // Azure rejects MP4 with codec specifications in MIME type
        if (audioBlob.type !== 'audio/mp4') {
          console.log('[OpenAI] Cleaning MP4 MIME type from:', audioBlob.type, 'to: audio/mp4')
          processedBlob = new Blob([audioBlob], { type: 'audio/mp4' })
        }
      } else if (audioBlob.type.includes('webm') || !audioBlob.type || audioBlob.type === '') {
        // Handle WebM or empty MIME type (default for recordings)
        filename = 'audio.webm'
        console.log('[OpenAI] Detected webm (or no type) - cleaning MIME type')
        // Always create clean webm blob for recordings to ensure Azure accepts it
        processedBlob = new Blob([audioBlob], { type: 'audio/webm' })
      }

      console.log('[OpenAI] Final filename:', filename)
      console.log('[OpenAI] Final blob type:', processedBlob.type)
      console.log('[OpenAI] Final blob size:', processedBlob.size, 'bytes')

      formData.append('file', processedBlob, filename)
      formData.append('language', 'en')
      formData.append('response_format', 'json')

      console.log('[OpenAI] FormData contents:')
      console.log('[OpenAI]   - file:', filename, '(', audioBlob.type, ')')
      console.log('[OpenAI]   - model:', this.whisperDeployment)
      console.log('[OpenAI]   - language: en')
      console.log('[OpenAI]   - response_format: json')

      const url = `${this.baseUrl}/openai/deployments/${this.whisperDeployment}/audio/transcriptions?api-version=${this.apiVersion}`
      console.log('[OpenAI] Request URL:', url)

      // Create timeout controller for mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error('[OpenAI] Request timeout - aborting')
        controller.abort()
      }, isMobile ? 300000 : 600000) // 5 min mobile, 10 min desktop

      console.log('[OpenAI] Sending request with timeout:', isMobile ? '5 min (mobile)' : '10 min (desktop)')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey
        },
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log('[OpenAI] Response received - status:', response.status)
      console.log('[OpenAI] Response headers:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[OpenAI] Error response body:', errorText)
        let errorMessage = `Transcription failed: ${response.status} ${response.statusText}`

        try {
          const errorData = JSON.parse(errorText)
          console.error('[OpenAI] Parsed error data:', JSON.stringify(errorData, null, 2))
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          }
        } catch (e) {
          // If error response is not JSON, use the raw text
          console.error('[OpenAI] Error response is not JSON')
          if (errorText) {
            errorMessage = errorText
          }
        }

        console.error('[OpenAI] Final error message:', errorMessage)
        throw new Error(errorMessage)
      }

      console.log('[OpenAI] Parsing JSON response...')
      const result = await response.json()
      console.log('[OpenAI] ✓ Transcription successful, length:', result.text?.length || 0, 'characters')
      return result.text || ''
    } catch (error) {
      console.error('[OpenAI] Transcription error:', error)
      console.error('[OpenAI] Error type:', error.constructor.name)
      console.error('[OpenAI] Error message:', error.message)
      console.error('[OpenAI] Error stack:', error.stack)

      // Log more details for mobile debugging
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (isMobile) {
        console.error('[OpenAI] ⚠️ ERROR ON MOBILE DEVICE')
        console.error('[OpenAI] File size being uploaded:', audioBlob?.size || 'unknown', 'bytes')
        console.error('[OpenAI] File type:', audioBlob?.type || 'unknown')
      }

      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error(`Transcription timeout: The audio file took too long to transcribe (>${isMobile ? '5' : '10'} minutes). ${isMobile ? 'Mobile devices have stricter timeouts. ' : ''}Try uploading a shorter audio file or using a faster connection.`)
      }

      if (error.message.includes('fetch') || error.name === 'TypeError') {
        throw new Error(`Network error: Unable to connect to Azure OpenAI. ${isMobile ? 'Mobile connection may be unstable. ' : ''}Please check your endpoint and internet connection. (${error.message})`)
      }
      throw error
    }
  }

  async transcribeChunked(chunkedAudio, progressCallback = null) {
    console.log('[OpenAI] === CHUNKED TRANSCRIPTION START ===')
    console.log('[OpenAI] Audio duration:', chunkedAudio.duration.toFixed(2), 'seconds')
    console.log('[OpenAI] Original file size:', chunkedAudio.sizeMB, 'MB')

    // Import audioService dynamically to avoid circular dependency
    const audioService = (await import('./audioService.js')).default

    // Split into 10-minute chunks (600 seconds)
    // At 16kHz mono, 10 minutes ≈ 19MB, safely under 25MB limit
    const chunkDuration = 600 // 10 minutes in seconds
    const audioChunks = audioService.splitAudioBuffer(chunkedAudio.buffer, chunkDuration)

    console.log('[OpenAI] Split into', audioChunks.length, 'chunks of', chunkDuration, 'seconds each')

    const transcripts = []

    for (let i = 0; i < audioChunks.length; i++) {
      console.log(`[OpenAI] Transcribing chunk ${i + 1}/${audioChunks.length}...`)

      // Update progress if callback provided
      if (progressCallback) {
        const percentage = 50 + Math.floor((i / audioChunks.length) * 25) // 50-75% range
        progressCallback({
          stage: 'transcribing',
          percentage,
          message: `Transcribing part ${i + 1}/${audioChunks.length}...`
        })
      }

      // Convert chunk to WAV blob
      const chunkBlob = audioService.audioBufferToWav(audioChunks[i])
      const chunkFile = new File([chunkBlob], `chunk-${i}.wav`, { type: 'audio/wav' })

      console.log(`[OpenAI] Chunk ${i + 1} size:`, (chunkFile.size / 1024 / 1024).toFixed(2), 'MB')

      // Transcribe this chunk
      const chunkTranscript = await this.transcribeAudio(chunkFile)
      transcripts.push(chunkTranscript)

      console.log(`[OpenAI] ✓ Chunk ${i + 1} transcribed:`, chunkTranscript.substring(0, 100) + '...')
    }

    // Combine all transcripts
    const fullTranscript = transcripts.join(' ')
    console.log('[OpenAI] === CHUNKED TRANSCRIPTION COMPLETE ===')
    console.log('[OpenAI] Total transcript length:', fullTranscript.length, 'characters')

    return fullTranscript
  }

  async extractTasks(transcript, existingTasks = []) {
    this.validateConfig()

    if (!transcript.trim()) {
      throw new Error('No transcript available to extract tasks from')
    }

    try {
      // Build context about existing tasks
      let existingTasksContext = ''
      if (existingTasks && existingTasks.length > 0) {
        existingTasksContext = '\n\nEXISTING TASKS IN PROJECT:\n' +
          existingTasks.map((task, idx) =>
            `${idx + 1}. "${task.title}" (Status: ${task.status || 'todo'}, Priority: ${task.priority || 'medium'})\n   Description: ${task.description || 'No description'}`
          ).join('\n')
      }

      const prompt = `You are a SPECIALIZED TASK EXTRACTION AGENT. Your ONLY job is to extract tasks and their status from meeting transcripts.

ANALYZE THE RAW TRANSCRIPT (not a summary) and extract ALL tasks, action items, and status updates.

CRITICAL - STATUS DETECTION:
Listen carefully for status keywords and phrases:
- "blocked" / "on hold" / "put on hold" / "pausing" / "waiting for" / "can't proceed" / "stuck" → status: "blocked"
- "completed" / "done" / "finished" / "wrapped up" → status: "done"
- "working on" / "in progress" / "currently doing" / "started" → status: "in-progress"
- "need to" / "will" / "should" / "going to" / "plan to" → status: "todo"

TASK IDENTIFICATION:
Focus on consolidating related activities into single tasks.

TASK CONSOLIDATION RULES:
1. CONSOLIDATE related activities into ONE task (e.g., "Plan Family Night Event" should include confirming date, planning activities, etc.)
2. Create comprehensive descriptions with sub-tasks using bullet points
3. If multiple people discuss the same project/topic, create ONE consolidated task
4. Extract due dates from natural language (e.g., "next week", "by Friday", "tomorrow")

MATCHING EXISTING TASKS:
1. If a task matches an EXISTING TASK (same project/topic), return with:
   - "matchId": the index number (1-based) of the matching existing task
   - "updates": new information to ADD to existing description
   - "newStatus": update status if mentioned
   - "newPriority": update priority if mentioned

2. If creating NEW consolidated task, do NOT use "matchId"

REQUIRED FIELDS for each task:
- "title": Project/topic name (max 50 chars)
- "description": Detailed description with sub-tasks as bullet points
- "priority": "high", "medium", or "low"
- "status": "todo", "in-progress", "blocked", or "done"
- "assignee": person assigned (if mentioned)
- "dueDate": ISO date string (YYYY-MM-DD) if timeline mentioned

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

DATE PARSING EXAMPLES:
- "next week" → ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "by Friday" → [calculate next Friday's date]
- "tomorrow" → ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "end of month" → [calculate last day of current month]

Return ONLY valid JSON array:
[
  {
    "matchId": 1,  // ONLY if matches existing task
    "title": "Family Night Event Planning",
    "description": "Organize family night event with following sub-tasks:\n• Confirm date with Brother Hanif\n• Plan activities and games\n• Arrange venue setup\n• Send invitations to family members",
    "updates": "Brother Hanif confirmed availability",  // ONLY if matchId exists
    "newStatus": "in-progress",  // ONLY if status changed
    "newPriority": "high",  // ONLY if priority changed
    "priority": "high",
    "status": "todo",
    "assignee": "Sarah",
    "dueDate": "2024-11-15"
  }
]
${existingTasksContext}

Meeting summary/transcript:
${transcript}`

      const url = `${this.baseUrl}/openai/deployments/${this.gptDeployment}/chat/completions?api-version=${this.apiVersion}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a SPECIALIZED TASK EXTRACTION AGENT. Your sole purpose is to analyze meeting transcripts and extract tasks with ACCURATE status detection. You must listen carefully for status keywords (blocked, in progress, done, etc.) and assign the correct status. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Task extraction failed: ${response.status} ${response.statusText}`

        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          }
        } catch (e) {
          if (errorText) {
            errorMessage = errorText
          }
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      let content = result.choices?.[0]?.message?.content || '[]'

      console.log('[OpenAI] ===== AI RAW RESPONSE =====')
      console.log('[OpenAI] Content type:', typeof content)
      console.log('[OpenAI] Content length:', content.length)
      console.log('[OpenAI] First 500 chars:', content.substring(0, 500))

      // Strip markdown code blocks if present (e.g., ```json ... ```)
      const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/
      const match = content.match(codeBlockRegex)
      if (match) {
        content = match[1].trim()
        console.log('[OpenAI] Stripped markdown code blocks from response')
        console.log('[OpenAI] Cleaned content length:', content.length)
      }

      // Try to parse JSON response
      try {
        const tasks = JSON.parse(content)
        console.log('[OpenAI] ✓ JSON parsed successfully')
        console.log('[OpenAI] Parsed type:', typeof tasks)
        console.log('[OpenAI] Is array:', Array.isArray(tasks))

        if (!Array.isArray(tasks)) {
          console.error('[OpenAI] ✗ Invalid response: not an array')
          throw new Error('Invalid response format')
        }

        console.log('[OpenAI] Number of tasks parsed:', tasks.length)
        console.log('[OpenAI] Raw tasks from AI:', JSON.stringify(tasks, null, 2))

        // Validate and sanitize tasks
        return tasks.map((task, index) => {
          console.log(`[OpenAI] Processing task ${index + 1}:`, JSON.stringify(task, null, 2))

          const sanitized = {
            title: (task.title || 'Untitled Task').substring(0, 50),
            description: task.description || '',
            priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium'
          }

          console.log(`[OpenAI] Base sanitized task ${index + 1}:`, sanitized)

          // Include matching and update information if present
          if (task.matchId) {
            sanitized.matchId = parseInt(task.matchId)
            console.log(`[OpenAI] Task ${index + 1} has matchId:`, sanitized.matchId)
          }
          if (task.updates) {
            sanitized.updates = task.updates
            console.log(`[OpenAI] Task ${index + 1} has updates:`, sanitized.updates)
          }
          if (task.newStatus && ['todo', 'in-progress', 'done', 'blocked'].includes(task.newStatus)) {
            sanitized.newStatus = task.newStatus
            console.log(`[OpenAI] Task ${index + 1} has newStatus:`, sanitized.newStatus)
          } else if (task.newStatus === 'on-hold') {
            sanitized.newStatus = 'blocked' // Map on-hold to blocked
            console.log(`[OpenAI] Task ${index + 1} newStatus mapped on-hold → blocked`)
          }
          if (task.newPriority && ['high', 'medium', 'low'].includes(task.newPriority)) {
            sanitized.newPriority = task.newPriority
            console.log(`[OpenAI] Task ${index + 1} has newPriority:`, sanitized.newPriority)
          }

          // CRITICAL: Always set status field, defaulting to 'todo' if not provided
          if (task.status && ['todo', 'in-progress', 'done', 'blocked'].includes(task.status)) {
            sanitized.status = task.status
            console.log(`[OpenAI] Task ${index + 1} status set:`, sanitized.status)
          } else if (task.status === 'on-hold') {
            sanitized.status = 'blocked' // Map on-hold to blocked
            console.log(`[OpenAI] Task ${index + 1} status mapped on-hold → blocked`)
          } else {
            sanitized.status = 'todo' // Default status if none provided
            console.log(`[OpenAI] Task ${index + 1} status defaulted to: todo`)
          }

          if (task.assignee) {
            sanitized.assignee = task.assignee
            console.log(`[OpenAI] Task ${index + 1} has assignee:`, sanitized.assignee)
          }

          // Validate and include dueDate if present
          if (task.dueDate) {
            // Validate ISO date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            if (dateRegex.test(task.dueDate)) {
              sanitized.dueDate = task.dueDate
              console.log(`[OpenAI] Task ${index + 1} has dueDate:`, sanitized.dueDate)
            }
          }

          console.log(`[OpenAI] ✓ Final sanitized task ${index + 1}:`, JSON.stringify(sanitized, null, 2))
          return sanitized
        })
      } catch (parseError) {
        console.warn('Failed to parse JSON response, attempting text extraction:', parseError)
        // Fallback: try to extract tasks from text
        return this.extractTasksFromText(content)
      }
    } catch (error) {
      console.error('Task extraction error:', error)
      if (error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Azure OpenAI. Please check your endpoint and internet connection.')
      }
      throw error
    }
  }

  // Find related tasks that should be updated together
  async findRelatedTasks(tasks, completedTaskTitle, completedTaskDescription) {
    if (!tasks || tasks.length === 0) return []

    try {
      const prompt = `Given that this task has been completed:

COMPLETED TASK:
Title: "${completedTaskTitle}"
Description: "${completedTaskDescription}"

EXISTING TASKS:
${tasks.map((task, idx) =>
  `${idx + 1}. "${task.title}" - ${task.description}`
).join('\n')}

Return ONLY a JSON array of task indices (1-based) that are related to the completed task and should also be marked as completed or updated. Tasks are related if they:
1. Are part of the same project/topic
2. Are sub-components of the same overall goal
3. Would logically be completed together

Return empty array [] if no related tasks found.

Example response: [2, 5] (if tasks 2 and 5 are related)

JSON array:`

      const url = `${this.baseUrl}/openai/deployments/${this.gptDeployment}/chat/completions?api-version=${this.apiVersion}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a task relationship analyzer. Return only JSON arrays.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        console.warn('Related tasks analysis failed, skipping')
        return []
      }

      const result = await response.json()
      const content = result.choices?.[0]?.message?.content || '[]'

      try {
        const indices = JSON.parse(content)
        return Array.isArray(indices) ? indices.map(i => parseInt(i) - 1) : [] // Convert to 0-based
      } catch (e) {
        console.warn('Failed to parse related tasks response')
        return []
      }
    } catch (error) {
      console.warn('Related tasks analysis error:', error)
      return []
    }
  }

  extractTasksFromText(text) {
    const tasks = []
    const lines = text.split('\n').map(line => line.trim()).filter(line => line)

    let currentTask = {}

    for (const line of lines) {
      // Look for task indicators
      if (line.match(/^\d+\.|\-|\*/) || line.toLowerCase().includes('task')) {
        // Save previous task if exists
        if (currentTask.title) {
          tasks.push({
            title: currentTask.title,
            description: currentTask.description || '',
            priority: currentTask.priority || 'medium'
          })
        }

        // Start new task
        currentTask = {
          title: line.replace(/^\d+\.|\-|\*/, '').trim().substring(0, 50),
          description: '',
          priority: 'medium'
        }
      } else if (line.toLowerCase().includes('description:')) {
        currentTask.description = line.replace(/description:/i, '').trim()
      } else if (line.toLowerCase().includes('priority:')) {
        const priority = line.replace(/priority:/i, '').trim().toLowerCase()
        currentTask.priority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium'
      } else if (currentTask.title && line.length > 10) {
        // Add to description if we have a task started
        currentTask.description = (currentTask.description + ' ' + line).trim()
      }
    }

    // Add the last task
    if (currentTask.title) {
      tasks.push({
        title: currentTask.title,
        description: currentTask.description || '',
        priority: currentTask.priority || 'medium'
      })
    }

    return tasks
  }

  async generateSummary(transcript) {
    this.validateConfig()

    if (!transcript.trim()) {
      throw new Error('No transcript available to generate summary from')
    }

    try {
      const prompt = `Create a structured meeting summary from the following transcript using this EXACT format:

## Key Discussion Points
- [Main topics discussed - be specific and detailed]

## Decisions Made
- [Any concrete decisions or agreements reached]

## Action Items
**[Project/Topic Name]:**
- [Sub-task 1: specific action needed]
- [Sub-task 2: specific action needed]
- [Timeline: if mentioned]
- [Assigned to: if mentioned]

**[Next Project/Topic Name]:**
- [Sub-task 1: specific action needed]
- [Timeline: if mentioned]

## Next Steps
- [Planned future actions or meetings]

IMPORTANT GUIDELINES:
1. Group related tasks under a single project/topic heading in Action Items
2. Break down complex topics into specific sub-tasks using bullet points
3. Include timelines and assignments when mentioned
4. Keep each action item specific and actionable
5. Use consistent formatting throughout

Meeting transcript:
${transcript}`

      const url = `${this.baseUrl}/openai/deployments/${this.gptDeployment}/chat/completions?api-version=${this.apiVersion}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a professional meeting secretary who creates clear, structured meeting summaries.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.5
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Summary generation failed: ${response.status} ${response.statusText}`

        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          }
        } catch (e) {
          if (errorText) {
            errorMessage = errorText
          }
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      return result.choices?.[0]?.message?.content || 'Unable to generate summary'
    } catch (error) {
      console.error('Summary generation error:', error)
      if (error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Azure OpenAI. Please check your endpoint and internet connection.')
      }
      throw error
    }
  }
}

export default new OpenAIService()