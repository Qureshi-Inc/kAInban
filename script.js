class AudioTaskManager {
  constructor() {
    this.mediaRecorder = null
    this.audioChunks = []
    this.isRecording = false
    this.audioContext = null
    this.analyser = null
    this.canvas = null
    this.canvasContext = null
    this.animationId = null
    this.recordingStartTime = null
    this.recordingInterval = null
    this.currentProject = null
    this.tasks = []
    this.transcriptText = ''

    this.azureConfig = {
      endpoint: localStorage.getItem('azureEndpoint') || '',
      apiKey: localStorage.getItem('azureApiKey') || ''
    }

    this.initializeApp()
  }

  initializeApp() {
    this.setupEventListeners()
    this.initializeDatabase()
    this.loadProjects()
    this.setupDragAndDrop()
  }

  setupEventListeners() {
    // Audio controls
    document.getElementById('recordBtn').addEventListener('click', () => this.startRecording())
    document.getElementById('uploadBtn').addEventListener('click', () => this.triggerFileUpload())
    document.getElementById('audioUpload').addEventListener('change', (e) => this.handleFileUpload(e))

    // Recording modal
    document.getElementById('stopRecording').addEventListener('click', () => this.stopRecording())
    document.getElementById('closeModal').addEventListener('click', () => this.closeRecordingModal())

    // Tasks
    document.getElementById('generateTasksBtn').addEventListener('click', () => this.generateTasks())
    document.getElementById('clearTasksBtn').addEventListener('click', () => this.clearTasks())

    // Summary
    document.getElementById('generateSummaryBtn').addEventListener('click', () => this.generateSummary())

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings())
    document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings())
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings())

    // Project management
    document.getElementById('newProjectBtn').addEventListener('click', () => this.createNewProject())
    document.getElementById('projectSelect').addEventListener('change', (e) => this.loadProject(e.target.value))

    // Close modals on outside click
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none'
      }
    })
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AudioTaskManager', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (e) => {
        const db = e.target.result

        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
          projectStore.createIndex('name', 'name', { unique: false })
          projectStore.createIndex('lastModified', 'lastModified', { unique: false })
        }

        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
          taskStore.createIndex('projectId', 'projectId', { unique: false })
          taskStore.createIndex('status', 'status', { unique: false })
        }
      }
    })
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.audioChunks = []
      this.isRecording = true

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.processRecording()
      }

      this.mediaRecorder.start(1000) // Collect data every second
      this.setupAudioVisualization(stream)
      this.showRecordingModal()
      this.startRecordingTimer()

      // Update UI
      document.getElementById('recordBtn').disabled = true
      document.getElementById('transcriptStatus').classList.add('active')

    } catch (error) {
      console.error('Error starting recording:', error)
      this.showNotification('Error accessing microphone. Please check permissions.', 'error')
    }
  }

  setupAudioVisualization(stream) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.analyser = this.audioContext.createAnalyser()
    const source = this.audioContext.createMediaStreamSource(stream)

    source.connect(this.analyser)
    this.analyser.fftSize = 256

    this.canvas = document.getElementById('audioCanvas')
    this.canvasContext = this.canvas.getContext('2d')

    this.drawVisualization()
  }

  drawVisualization() {
    if (!this.isRecording) {return}

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    const { width, height } = this.canvas
    this.canvasContext.fillStyle = '#f8f9fa'
    this.canvasContext.fillRect(0, 0, width, height)

    const barWidth = (width / bufferLength) * 2.5
    let barHeight
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height * 0.8

      const gradient = this.canvasContext.createLinearGradient(0, height - barHeight, 0, height)
      gradient.addColorStop(0, '#4285f4')
      gradient.addColorStop(1, '#34a853')

      this.canvasContext.fillStyle = gradient
      this.canvasContext.fillRect(x, height - barHeight, barWidth, barHeight)

      x += barWidth + 1
    }

    this.animationId = requestAnimationFrame(() => this.drawVisualization())
  }

  startRecordingTimer() {
    this.recordingStartTime = Date.now()
    this.recordingInterval = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime
      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      document.getElementById('recordingTime').textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }, 1000)
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false

      // Stop visualization
      if (this.animationId) {
        cancelAnimationFrame(this.animationId)
      }
      if (this.audioContext) {
        this.audioContext.close()
      }
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval)
      }

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())

      this.closeRecordingModal()

      // Update UI
      document.getElementById('recordBtn').disabled = false
      document.getElementById('transcriptStatus').classList.remove('active')
    }
  }

  async processRecording() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    await this.transcribeAudio(audioBlob)
  }

  triggerFileUpload() {
    document.getElementById('audioUpload').click()
  }

  async handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) {return}

    if (!file.type.startsWith('audio/')) {
      this.showNotification('Please select a valid audio file.', 'error')
      return
    }

    this.showNotification('Processing audio file...', 'info')
    await this.transcribeAudio(file)
  }

  async transcribeAudio(audioBlob) {
    if (!this.azureConfig.endpoint || !this.azureConfig.apiKey) {
      this.showNotification('Please configure Azure OpenAI settings first.', 'error')
      this.openSettings()
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('language', 'en')

      const response = await fetch(`${this.azureConfig.endpoint}/openai/deployments/whisper-1/audio/transcriptions?api-version=2024-02-01`, {
        method: 'POST',
        headers: {
          'api-key': this.azureConfig.apiKey
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
      }

      const result = await response.json()
      this.transcriptText = result.text

      this.displayTranscript(this.transcriptText)
      document.getElementById('generateTasksBtn').disabled = false

      this.showNotification('Transcription completed successfully!', 'success')

    } catch (error) {
      console.error('Transcription error:', error)
      this.showNotification('Transcription failed. Please check your settings and try again.', 'error')
    }
  }

  displayTranscript(text) {
    const transcriptDisplay = document.getElementById('transcriptDisplay')
    transcriptDisplay.innerHTML = `<p>${text}</p>`
    transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight
  }

  async generateTasks() {
    if (!this.transcriptText) {
      this.showNotification('No transcript available to generate tasks from.', 'error')
      return
    }

    try {
      const prompt = `Analyze the following meeting transcript and extract actionable tasks. For each task, provide:
            1. A clear title (max 50 characters)
            2. A brief description
            3. Priority (high, medium, low)
            4. Estimated effort (if mentioned or can be inferred)

            Format the response as a JSON array of tasks with properties: title, description, priority, effort.

            Transcript: ${this.transcriptText}`

      const response = await fetch(`${this.azureConfig.endpoint}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-01`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.azureConfig.apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that extracts actionable tasks from meeting transcripts.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1500,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`Task generation failed: ${response.statusText}`)
      }

      const result = await response.json()
      const tasksText = result.choices[0].message.content

      // Try to parse JSON from the response
      let extractedTasks
      try {
        extractedTasks = JSON.parse(tasksText)
      } catch (e) {
        // If JSON parsing fails, extract tasks manually
        extractedTasks = this.parseTasksFromText(tasksText)
      }

      this.addTasksToKanban(extractedTasks)
      this.showNotification(`Generated ${extractedTasks.length} tasks successfully!`, 'success')

    } catch (error) {
      console.error('Task generation error:', error)
      this.showNotification('Failed to generate tasks. Please try again.', 'error')
    }
  }

  parseTasksFromText(text) {
    // Fallback parser for non-JSON responses
    const tasks = []
    const lines = text.split('\n')
    let currentTask = {}

    lines.forEach(line => {
      line = line.trim()
      if (line.includes('title:') || line.includes('Title:')) {
        if (currentTask.title) {
          tasks.push(currentTask)
          currentTask = {}
        }
        currentTask.title = line.replace(/title:/i, '').trim()
      } else if (line.includes('description:') || line.includes('Description:')) {
        currentTask.description = line.replace(/description:/i, '').trim()
      } else if (line.includes('priority:') || line.includes('Priority:')) {
        const priority = line.replace(/priority:/i, '').trim().toLowerCase()
        currentTask.priority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium'
      }
    })

    if (currentTask.title) {
      tasks.push(currentTask)
    }

    return tasks
  }

  addTasksToKanban(extractedTasks) {
    extractedTasks.forEach(task => {
      const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      const taskData = {
        id: taskId,
        title: task.title || 'Untitled Task',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: 'todo',
        createdAt: new Date().toISOString(),
        projectId: this.currentProject?.id || null
      }

      this.tasks.push(taskData)
      this.renderTask(taskData)
    })

    this.updateTaskCounts()
    this.saveCurrentProject()
  }

  renderTask(task) {
    const card = document.createElement('div')
    card.className = 'task-card'
    card.draggable = true
    card.dataset.taskId = task.id

    card.innerHTML = `
            <h5>${task.title}</h5>
            <p>${task.description}</p>
            <div class="task-meta">
                <span class="priority ${task.priority}">${task.priority}</span>
                <span class="date">${new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
        `

    const column = document.getElementById(`${task.status}-cards`)
    column.appendChild(card)

    this.setupTaskDragEvents(card)
  }

  setupDragAndDrop() {
    const columns = document.querySelectorAll('.cards')

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault()
        column.classList.add('drag-over')
      })

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over')
      })

      column.addEventListener('drop', (e) => {
        e.preventDefault()
        column.classList.remove('drag-over')

        const taskId = e.dataTransfer.getData('text/plain')
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`)
        const newStatus = column.id.replace('-cards', '')

        if (taskCard && taskCard.parentNode !== column) {
          column.appendChild(taskCard)
          this.updateTaskStatus(taskId, newStatus)
        }
      })
    })
  }

  setupTaskDragEvents(card) {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.taskId)
      card.classList.add('dragging')
    })

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging')
    })
  }

  updateTaskStatus(taskId, newStatus) {
    const task = this.tasks.find(t => t.id === taskId)
    if (task) {
      task.status = newStatus
      this.updateTaskCounts()
      this.saveCurrentProject()
    }
  }

  updateTaskCounts() {
    const counts = { todo: 0, inprogress: 0, done: 0 }
    this.tasks.forEach(task => {
      if (counts.hasOwnProperty(task.status)) {
        counts[task.status]++
      }
    })

    Object.keys(counts).forEach(status => {
      const countElement = document.getElementById(`${status}-count`)
      if (countElement) {
        countElement.textContent = counts[status]
      }
    })
  }

  clearTasks() {
    if (confirm('Are you sure you want to clear all tasks?')) {
      this.tasks = []
      document.querySelectorAll('.cards').forEach(column => {
        column.innerHTML = ''
      })
      this.updateTaskCounts()
      this.saveCurrentProject()
    }
  }

  async generateSummary() {
    if (!this.transcriptText) {
      this.showNotification('No transcript available to generate summary from.', 'error')
      return
    }

    try {
      const prompt = `Create a concise meeting summary from the following transcript. Include:
            1. Key discussion points
            2. Decisions made
            3. Action items
            4. Next steps

            Keep it professional and under 300 words.

            Transcript: ${this.transcriptText}`

      const response = await fetch(`${this.azureConfig.endpoint}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-01`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.azureConfig.apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates meeting summaries.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`Summary generation failed: ${response.statusText}`)
      }

      const result = await response.json()
      const summary = result.choices[0].message.content

      document.getElementById('notesSummary').innerHTML = `<p>${summary.replace(/\n/g, '</p><p>')}</p>`

      if (this.currentProject) {
        this.currentProject.summary = summary
        this.saveCurrentProject()
      }

      this.showNotification('Meeting summary generated successfully!', 'success')

    } catch (error) {
      console.error('Summary generation error:', error)
      this.showNotification('Failed to generate summary. Please try again.', 'error')
    }
  }

  // Project Management
  async createNewProject() {
    const projectName = prompt('Enter project name:')
    if (!projectName) {return}

    const project = {
      id: 'project_' + Date.now(),
      name: projectName,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tasks: [],
      transcript: '',
      summary: ''
    }

    await this.saveProject(project)
    this.loadProjects()
    this.loadProject(project.id)
  }

  async loadProjects() {
    try {
      const transaction = this.db.transaction(['projects'], 'readonly')
      const store = transaction.objectStore('projects')
      const request = store.getAll()

      request.onsuccess = () => {
        const projects = request.result
        const select = document.getElementById('projectSelect')
        select.innerHTML = '<option value="">Select Project</option>'

        projects.forEach(project => {
          const option = document.createElement('option')
          option.value = project.id
          option.textContent = project.name
          select.appendChild(option)
        })
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  async loadProject(projectId) {
    if (!projectId) {
      this.currentProject = null
      this.clearCurrentSession()
      return
    }

    try {
      const transaction = this.db.transaction(['projects'], 'readonly')
      const store = transaction.objectStore('projects')
      const request = store.get(projectId)

      request.onsuccess = () => {
        this.currentProject = request.result
        if (this.currentProject) {
          this.loadProjectData()
        }
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

  loadProjectData() {
    // Load transcript
    if (this.currentProject.transcript) {
      this.transcriptText = this.currentProject.transcript
      this.displayTranscript(this.transcriptText)
      document.getElementById('generateTasksBtn').disabled = false
    }

    // Load summary
    if (this.currentProject.summary) {
      document.getElementById('notesSummary').innerHTML = `<p>${this.currentProject.summary.replace(/\n/g, '</p><p>')}</p>`
    }

    // Load tasks
    this.tasks = this.currentProject.tasks || []
    this.clearKanbanBoard()
    this.tasks.forEach(task => this.renderTask(task))
    this.updateTaskCounts()
  }

  clearCurrentSession() {
    this.transcriptText = ''
    this.tasks = []
    document.getElementById('transcriptDisplay').innerHTML = '<p class="placeholder">Start recording or upload audio to see transcription...</p>'
    document.getElementById('notesSummary').innerHTML = '<p class="placeholder">Meeting summary will appear here...</p>'
    document.getElementById('generateTasksBtn').disabled = true
    this.clearKanbanBoard()
    this.updateTaskCounts()
  }

  clearKanbanBoard() {
    document.querySelectorAll('.cards').forEach(column => {
      column.innerHTML = ''
    })
  }

  async saveProject(project) {
    try {
      const transaction = this.db.transaction(['projects'], 'readwrite')
      const store = transaction.objectStore('projects')
      await store.put(project)
    } catch (error) {
      console.error('Error saving project:', error)
    }
  }

  async saveCurrentProject() {
    if (!this.currentProject) {return}

    this.currentProject.tasks = this.tasks
    this.currentProject.transcript = this.transcriptText
    this.currentProject.lastModified = new Date().toISOString()

    await this.saveProject(this.currentProject)
  }

  // UI Helper Methods
  showRecordingModal() {
    document.getElementById('recordingModal').style.display = 'block'
  }

  closeRecordingModal() {
    document.getElementById('recordingModal').style.display = 'none'
  }

  openSettings() {
    document.getElementById('azureEndpoint').value = this.azureConfig.endpoint
    document.getElementById('azureApiKey').value = this.azureConfig.apiKey
    document.getElementById('settingsModal').style.display = 'block'
  }

  closeSettings() {
    document.getElementById('settingsModal').style.display = 'none'
  }

  saveSettings() {
    const endpoint = document.getElementById('azureEndpoint').value.trim()
    const apiKey = document.getElementById('azureApiKey').value.trim()

    if (!endpoint || !apiKey) {
      this.showNotification('Please fill in all required fields.', 'error')
      return
    }

    this.azureConfig.endpoint = endpoint
    this.azureConfig.apiKey = apiKey

    localStorage.setItem('azureEndpoint', endpoint)
    localStorage.setItem('azureApiKey', apiKey)

    this.closeSettings()
    this.showNotification('Settings saved successfully!', 'success')
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div')
    notification.className = `notification ${type}`
    notification.textContent = message

    // Add styles
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '3000',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    })

    // Set background color based on type
    const colors = {
      success: '#34a853',
      error: '#ea4335',
      info: '#4285f4',
      warning: '#fbbc04'
    }

    notification.style.backgroundColor = colors[type] || colors.info

    document.body.appendChild(notification)

    // Remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 4000)
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AudioTaskManager()
})