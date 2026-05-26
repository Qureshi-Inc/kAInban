import apiService from './apiService'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

class OpenAIService {
  constructor() {
    this.provider = 'azure'
    this.azureEndpoint = ''
    this.openaiBaseUrl = DEFAULT_OPENAI_BASE_URL
    this.keyConfigured = false
    this.apiVersion = '2024-06-01'
    this.whisperDeployment = 'whisper-1'
    this.gptDeployment = 'gpt-4'
    this.openaiWhisperModel = 'whisper-1'
    this.openaiGptModel = 'gpt-4o'
  }

  configure(settings) {
    this.provider = settings.provider === 'openai' ? 'openai' : 'azure'
    this.azureEndpoint = settings.azureEndpoint?.replace(/\/$/, '') || ''
    this.openaiBaseUrl = (
      settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL
    ).replace(/\/$/, '')
    this.apiVersion = settings.apiVersion || '2024-06-01'
    this.whisperDeployment = settings.whisperDeployment || 'whisper-1'
    this.gptDeployment = settings.gptDeployment || 'gpt-4'
    this.openaiWhisperModel = settings.openaiWhisperModel || 'whisper-1'
    this.openaiGptModel = settings.openaiGptModel || 'gpt-4o'
    this.keyConfigured = Boolean(settings.keyConfigured || settings.apiKey)
  }

  validateConfig() {
    if (!this.keyConfigured) {
      throw new Error(
        'AI provider API key is not configured. Ask an admin to configure AI settings.'
      )
    }
    if (this.provider === 'azure' && !this.azureEndpoint) {
      throw new Error(
        'Azure OpenAI endpoint is not configured. Ask an admin to update AI settings.'
      )
    }
  }

  providerLabel() {
    return this.provider === 'openai' ? 'OpenAI' : 'Azure OpenAI'
  }

  whisperModelName() {
    return this.provider === 'openai'
      ? this.openaiWhisperModel
      : this.whisperDeployment
  }

  gptModelName() {
    return this.provider === 'openai' ? this.openaiGptModel : this.gptDeployment
  }

  extractContentFromCompletion(result) {
    return result?.choices?.[0]?.message?.content || ''
  }

  stripMarkdownCodeBlock(content) {
    if (!content) {
      return content
    }
    const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/
    const match = content.trim().match(codeBlockRegex)
    return match ? match[1].trim() : content
  }

  async requestChat(messages, options = {}) {
    this.validateConfig()
    return apiService.aiChat({
      messages,
      max_tokens:
        options.max_tokens !== undefined
          ? options.max_tokens
          : options.maxTokens,
      temperature: options.temperature,
      model: options.model || this.gptModelName(),
      response_format: options.response_format
    })
  }

  async transcribeAudio(audioBlob, progressCallback = null) {
    this.validateConfig()

    try {
      if (audioBlob?.needsChunking) {
        return await this.transcribeChunked(audioBlob, progressCallback)
      }

      const formData = new FormData()
      let filename = 'audio.webm'
      let processedBlob = audioBlob

      if (audioBlob.name && audioBlob.name.toLowerCase().endsWith('.m4a')) {
        filename = 'audio.m4a'
      } else if (audioBlob.type.includes('m4a')) {
        filename = 'audio.m4a'
      } else if (audioBlob.type.includes('mp3')) {
        filename = 'audio.mp3'
      } else if (audioBlob.type.includes('wav')) {
        filename = 'audio.wav'
      } else if (audioBlob.type.includes('ogg')) {
        filename = 'audio.ogg'
      } else if (audioBlob.type.includes('mp4')) {
        filename = 'audio.mp4'
        if (audioBlob.type !== 'audio/mp4') {
          processedBlob = new Blob([audioBlob], { type: 'audio/mp4' })
        }
      } else if (
        audioBlob.type.includes('webm') ||
        !audioBlob.type ||
        audioBlob.type === ''
      ) {
        filename = 'audio.webm'
        processedBlob = new Blob([audioBlob], { type: 'audio/webm' })
      }

      formData.append('file', processedBlob, filename)
      formData.append('language', 'en')
      formData.append('response_format', 'json')
      if (this.provider === 'openai') {
        formData.append('model', this.whisperModelName())
      }

      const result = await apiService.aiTranscribe(formData)
      return result.text || ''
    } catch (error) {
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        throw new Error(
          `Network error: Unable to connect to ${this.providerLabel()}. Please check your endpoint and internet connection.`
        )
      }
      throw error
    }
  }

  async transcribeChunked(chunkedAudio, progressCallback = null) {
    const audioService = (await import('./audioService.js')).default
    const chunkDuration = 600
    const audioChunks = audioService.splitAudioBuffer(
      chunkedAudio.buffer,
      chunkDuration
    )

    const transcripts = []
    for (let i = 0; i < audioChunks.length; i++) {
      if (progressCallback) {
        const percentage = 50 + Math.floor((i / audioChunks.length) * 25)
        progressCallback({
          stage: 'transcribing',
          percentage,
          message: `Transcribing part ${i + 1}/${audioChunks.length}...`
        })
      }

      const chunkBlob = audioService.audioBufferToWav(audioChunks[i])
      const chunkFile = new File([chunkBlob], `chunk-${i}.wav`, {
        type: 'audio/wav'
      })
      const chunkTranscript = await this.transcribeAudio(chunkFile)
      transcripts.push(chunkTranscript)
    }

    return transcripts.join(' ')
  }

  async extractTasks(transcript, existingTasks = []) {
    this.validateConfig()

    if (!transcript.trim()) {
      throw new Error('No transcript available to extract tasks from')
    }

    try {
      let existingTasksContext = ''
      if (existingTasks && existingTasks.length > 0) {
        existingTasksContext =
          '\n\nEXISTING TASKS IN PROJECT:\n' +
          existingTasks
            .map(
              (task, idx) =>
                `${idx + 1}. "${task.title}" (Status: ${task.status || 'todo'}, Priority: ${task.priority || 'medium'})\n   Description: ${task.description || 'No description'}`
            )
            .join('\n')
      }

      const prompt = `You are a SPECIALIZED TASK EXTRACTION AGENT. Your ONLY job is to extract tasks and their status from meeting transcripts.

ANALYZE THE RAW TRANSCRIPT (not a summary) and extract ALL tasks, action items, and status updates.

CRITICAL - STATUS DETECTION:
Listen carefully for status keywords and phrases:
- "blocked" / "on hold" / "put on hold" / "pausing" / "waiting for" / "can't proceed" / "stuck" -> status: "blocked"
- "completed" / "done" / "finished" / "wrapped up" -> status: "done"
- "working on" / "in progress" / "currently doing" / "started" -> status: "in-progress"
- "need to" / "will" / "should" / "going to" / "plan to" -> status: "todo"

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
   - "updates": new information to add as an AI comment (do NOT modify existing description)
   - "newStatus": update status if mentioned
   - "newPriority": update priority if mentioned
   - "newAssignee": update assignee if mentioned
   - "newDueDate": update due date if mentioned (YYYY-MM-DD format)

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
- "next week" -> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "by Friday" -> [calculate next Friday's date]
- "tomorrow" -> ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "end of month" -> [calculate last day of current month]

Return ONLY valid JSON array:
[
  {
    "matchId": 1,
    "title": "Family Night Event Planning",
    "description": "Organize family night event with following sub-tasks:\n- Confirm date with Brother Hanif\n- Plan activities and games\n- Arrange venue setup\n- Send invitations to family members",
    "updates": "Brother Hanif confirmed availability for this Saturday",
    "newStatus": "in-progress",
    "newPriority": "high",
    "priority": "high",
    "status": "todo",
    "assignee": "Sarah",
    "dueDate": "2024-11-15"
  }
]
${existingTasksContext}

Meeting summary/transcript:
${transcript}`

      const result = await this.requestChat(
        [
          {
            role: 'system',
            content:
              'You are a SPECIALIZED TASK EXTRACTION AGENT. You must respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        { max_tokens: 2000, temperature: 0.1 }
      )

      let content = this.extractContentFromCompletion(result) || '[]'
      content = this.stripMarkdownCodeBlock(content)

      try {
        const tasks = JSON.parse(content)
        if (!Array.isArray(tasks)) {
          throw new Error('Invalid response format')
        }

        return tasks.map(task => {
          const sanitized = {
            title: (task.title || 'Untitled Task').substring(0, 50),
            description: task.description || '',
            priority: ['high', 'medium', 'low'].includes(task.priority)
              ? task.priority
              : 'medium'
          }

          if (task.matchId) {
            sanitized.matchId = parseInt(task.matchId)
          }
          if (task.updates) {
            sanitized.updates = task.updates
          }
          if (
            task.newStatus &&
            ['todo', 'in-progress', 'done', 'blocked'].includes(task.newStatus)
          ) {
            sanitized.newStatus = task.newStatus
          } else if (task.newStatus === 'on-hold') {
            sanitized.newStatus = 'blocked'
          }
          if (
            task.newPriority &&
            ['high', 'medium', 'low'].includes(task.newPriority)
          ) {
            sanitized.newPriority = task.newPriority
          }
          if (task.newAssignee) {
            sanitized.newAssignee = task.newAssignee
          }
          if (task.newDueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.newDueDate)) {
            sanitized.newDueDate = task.newDueDate
          }

          if (
            task.status &&
            ['todo', 'in-progress', 'done', 'blocked'].includes(task.status)
          ) {
            sanitized.status = task.status
          } else if (task.status === 'on-hold') {
            sanitized.status = 'blocked'
          } else {
            sanitized.status = 'todo'
          }

          if (task.assignee) {
            sanitized.assignee = task.assignee
          }
          if (task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
            sanitized.dueDate = task.dueDate
          }

          return sanitized
        })
      } catch (_parseError) {
        return this.extractTasksFromText(content)
      }
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(
          `Network error: Unable to connect to ${this.providerLabel()}. Please check your endpoint and internet connection.`
        )
      }
      throw error
    }
  }

  async findRelatedTasks(tasks, completedTaskTitle, completedTaskDescription) {
    if (!tasks || tasks.length === 0) {
      return []
    }

    try {
      const prompt = `Given that this task has been completed:

COMPLETED TASK:
Title: "${completedTaskTitle}"
Description: "${completedTaskDescription}"

EXISTING TASKS:
${tasks
  .map((task, idx) => `${idx + 1}. "${task.title}" - ${task.description}`)
  .join('\n')}

Return ONLY a JSON array of task indices (1-based) that are related to the completed task and should also be marked as completed or updated. Tasks are related if they:
1. Are part of the same project/topic
2. Are sub-components of the same overall goal
3. Would logically be completed together

Return empty array [] if no related tasks found.
Example response: [2, 5]
JSON array:`

      const result = await this.requestChat(
        [
          {
            role: 'system',
            content:
              'You are a task relationship analyzer. Return only JSON arrays.'
          },
          { role: 'user', content: prompt }
        ],
        { max_tokens: 200, temperature: 0.1 }
      )

      const content = this.stripMarkdownCodeBlock(
        this.extractContentFromCompletion(result) || '[]'
      )
      try {
        const indices = JSON.parse(content)
        return Array.isArray(indices) ? indices.map(i => parseInt(i) - 1) : []
      } catch (_e) {
        return []
      }
    } catch (_error) {
      return []
    }
  }

  extractTasksFromText(text) {
    const tasks = []
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)

    let currentTask = {}
    for (const line of lines) {
      if (line.match(/^\d+\.|-|\*/) || line.toLowerCase().includes('task')) {
        if (currentTask.title) {
          tasks.push({
            title: currentTask.title,
            description: currentTask.description || '',
            priority: currentTask.priority || 'medium'
          })
        }
        currentTask = {
          title: line
            .replace(/^(?:\d+\.\s*|[-*]\s*)+/g, '')
            .trim()
            .substring(0, 50),
          description: '',
          priority: 'medium'
        }
      } else if (line.toLowerCase().includes('description:')) {
        currentTask.description = line.replace(/description:/i, '').trim()
      } else if (line.toLowerCase().includes('priority:')) {
        const priority = line
          .replace(/priority:/i, '')
          .trim()
          .toLowerCase()
        currentTask.priority = ['high', 'medium', 'low'].includes(priority)
          ? priority
          : 'medium'
      } else if (currentTask.title && line.length > 10) {
        currentTask.description = (currentTask.description + ' ' + line).trim()
      }
    }

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

    try {
      const result = await this.requestChat(
        [
          {
            role: 'system',
            content:
              'You are a professional meeting secretary who creates clear, structured meeting summaries.'
          },
          { role: 'user', content: prompt }
        ],
        { max_tokens: 800, temperature: 0.5 }
      )
      return (
        this.extractContentFromCompletion(result) ||
        'Unable to generate summary'
      )
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(
          `Network error: Unable to connect to ${this.providerLabel()}. Please check your endpoint and internet connection.`
        )
      }
      throw error
    }
  }

  async generateAnalyticsInsights(analytics) {
    this.validateConfig()
    if (!analytics || analytics.total === 0) {
      throw new Error('No task data available for analysis')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tasksWithContext = analytics.tasks.map(task => {
      let dueContext = ''
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate)
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
        if (daysDiff < 0) {
          dueContext = ` (OVERDUE by ${Math.abs(daysDiff)} days)`
        } else if (daysDiff === 0) {
          dueContext = ' (DUE TODAY)'
        } else if (daysDiff <= 7) {
          dueContext = ` (Due in ${daysDiff} days)`
        } else {
          dueContext = ` (Due: ${task.dueDate})`
        }
      }
      return { ...task, dueContext }
    })

    const urgentTasks = tasksWithContext.filter(
      t =>
        t.status !== 'done' &&
        (t.dueContext.includes('OVERDUE') ||
          t.dueContext.includes('DUE TODAY') ||
          t.priority === 'high')
    )
    const lowEffortTasks = tasksWithContext.filter(
      t => t.status !== 'done' && t.priority === 'low'
    )
    const activeTasks = tasksWithContext.filter(
      t => t.status === 'in-progress' || t.status === 'todo'
    )

    const prompt = `You are a productivity coach reviewing someone's task list. Provide brief, actionable insights to help them prioritize their work.

CURRENT TASKS:
${tasksWithContext
  .slice(0, 25)
  .map(
    (task, idx) =>
      `${idx + 1}. "${task.title}" - Status: ${task.status}, Priority: ${task.priority}${task.dueContext}${task.description ? ` - ${task.description.substring(0, 100)}` : ''}`
  )
  .join('\n')}
${tasksWithContext.length > 25 ? `\n...and ${tasksWithContext.length - 25} more tasks` : ''}

CONTEXT:
- ${urgentTasks.length} urgent/overdue tasks
- ${activeTasks.length} active tasks (in-progress or todo)
- ${lowEffortTasks.length} low priority tasks
- ${analytics.blocked} blocked tasks

Provide 3 short, focused insights:

**🎯 What you should focus on this week:**
[1-2 sentences highlighting the most important/urgent tasks to tackle, referencing specific task titles]

**✅ Something low effort you can take off your list:**
[1-2 sentences identifying a quick win - a low priority or simple task they can complete easily to build momentum]

**⚠️ What's really urgent and needs to be addressed:**
[1-2 sentences calling out overdue items or high-priority tasks that need immediate attention]

Keep each insight concise and reference specific task titles. Be encouraging but direct.`

    try {
      const result = await this.requestChat(
        [
          {
            role: 'system',
            content:
              'You are a helpful productivity coach who provides brief, actionable insights.'
          },
          { role: 'user', content: prompt }
        ],
        { max_tokens: 800, temperature: 0.7 }
      )
      return (
        this.extractContentFromCompletion(result) ||
        'Unable to generate insights'
      )
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(
          `Network error: Unable to connect to ${this.providerLabel()}. Please check your endpoint and internet connection.`
        )
      }
      throw error
    }
  }

  async generateEmailTemplate(taskContext, subtaskText) {
    this.validateConfig()
    const prompt = `Based on the following task context, generate a professional email template for the specific subtask action.

**MAIN TASK:**
Title: ${taskContext.title}
Description: ${taskContext.description || 'No description'}
Priority: ${taskContext.priority}
Status: ${taskContext.status}

**SPECIFIC SUBTASK TO CREATE EMAIL FOR:**
${subtaskText}

Please generate a professional email template that:
1. Has an appropriate subject line
2. Is contextually relevant to both the main task and the specific subtask
3. Is professional but not overly formal
4. Includes placeholders for recipient name and sender name
5. Is ready to use but can be customized

Format the email with clear sections (Subject, Body with greeting, main content, and closing).`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a professional email writing assistant. Generate clear, concise templates.'
        },
        { role: 'user', content: prompt }
      ],
      { max_tokens: 800, temperature: 0.7 }
    )
    return (
      this.extractContentFromCompletion(result) ||
      'Unable to generate email template'
    )
  }

  async generateSlackMessage(taskContext, subtaskText) {
    this.validateConfig()
    const prompt = `Based on the following task context, generate a professional yet conversational Slack message for the specific subtask action.

**MAIN TASK:**
Title: ${taskContext.title}
Description: ${taskContext.description || 'No description'}
Priority: ${taskContext.priority}
Status: ${taskContext.status}

**SPECIFIC SUBTASK TO CREATE SLACK MESSAGE FOR:**
${subtaskText}

Please generate a Slack message that:
1. Is concise and conversational
2. Is contextually relevant
3. Uses appropriate emojis where they help
4. Includes formatting like *bold* where appropriate
5. Is engaging but professional`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a helpful Slack messaging assistant. Keep messages concise and clear.'
        },
        { role: 'user', content: prompt }
      ],
      { max_tokens: 500, temperature: 0.7 }
    )
    return (
      this.extractContentFromCompletion(result) ||
      'Unable to generate Slack message'
    )
  }

  async generateDocumentTemplate(taskContext, subtaskText) {
    this.validateConfig()
    const prompt = `Based on the following task context, generate a structured document template for the specific subtask action.

**MAIN TASK:**
Title: ${taskContext.title}
Description: ${taskContext.description || 'No description'}
Priority: ${taskContext.priority}
Status: ${taskContext.status}

**SPECIFIC SUBTASK TO CREATE DOCUMENT FOR:**
${subtaskText}

Please generate a professional document template in Markdown format with relevant sections and actionable items.`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a professional document writing assistant. Return markdown content.'
        },
        { role: 'user', content: prompt }
      ],
      { max_tokens: 1000, temperature: 0.6 }
    )
    return (
      this.extractContentFromCompletion(result) ||
      'Unable to generate document template'
    )
  }

  async generateCodeTemplate(taskContext, subtaskText) {
    this.validateConfig()
    const prompt = `Based on the following task context, generate a code template for the specific subtask action.

**MAIN TASK:**
Title: ${taskContext.title}
Description: ${taskContext.description || 'No description'}
Priority: ${taskContext.priority}
Status: ${taskContext.status}

**SPECIFIC SUBTASK TO CREATE CODE FOR:**
${subtaskText}

Please generate a code template with best-practice structure, comments, and TODOs. If unsure of language, default to JavaScript.`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a professional software development assistant. Return practical code templates.'
        },
        { role: 'user', content: prompt }
      ],
      { max_tokens: 800, temperature: 0.5 }
    )
    return (
      this.extractContentFromCompletion(result) ||
      'Unable to generate code template'
    )
  }

  async generateResearchTemplate(taskContext, subtaskText) {
    this.validateConfig()
    const prompt = `Create a concise research plan for this subtask.

Task title: ${taskContext.title}
Task description: ${taskContext.description || 'No description'}
Subtask: ${subtaskText}

Return:
1) Objective
2) Key questions
3) Sources to check
4) Suggested output format
5) Next 3 concrete steps`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a research planning assistant. Keep output clear and actionable.'
        },
        { role: 'user', content: prompt }
      ],
      { max_tokens: 600, temperature: 0.4 }
    )
    return (
      this.extractContentFromCompletion(result) ||
      'Unable to generate research guide'
    )
  }

  async updateTaskWithContext(taskContext, userContext) {
    this.validateConfig()
    const prompt = `You are a smart task management assistant. A user wants to update a task by providing additional context.

CURRENT TASK:
Title: ${taskContext.title}
Description: ${taskContext.description || 'No description'}
Priority: ${taskContext.priority}
Status: ${taskContext.status}
Assignees: ${taskContext.assignees?.join(', ') || 'None'}
Due Date: ${taskContext.dueDate || 'Not set'}
Subtasks: ${taskContext.subtasks?.map(s => `- ${s.text} (${s.completed ? 'completed' : 'pending'})`).join('\n') || 'None'}

USER CONTEXT:
${userContext}

Return JSON:
{
  "title": "...",
  "description": "...",
  "priority": "low|medium|high",
  "status": "todo|in-progress|blocked|done",
  "assignees": ["..."],
  "dueDate": "YYYY-MM-DD or null",
  "subtasks": ["..."],
  "reasoning": "..."
}`

    const result = await this.requestChat(
      [
        {
          role: 'system',
          content:
            'You are a task management assistant. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      {
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }
    )

    const content = this.stripMarkdownCodeBlock(
      this.extractContentFromCompletion(result)
    )
    if (!content) {
      throw new Error('No response content from AI')
    }

    try {
      return JSON.parse(content)
    } catch (parseError) {
      throw new Error(
        `AI returned invalid JSON response: ${parseError.message}`
      )
    }
  }
}

export default new OpenAIService()
