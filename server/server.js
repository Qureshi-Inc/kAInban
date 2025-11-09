import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'
import * as db from './database.js'

const app = express()
const PORT = process.env.PORT || 3001
const STORAGE_DIR = process.env.STORAGE_DIR || './storage'
const MEETINGS_DIR = path.join(STORAGE_DIR, 'meetings')

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8064',
    'https://localhost:8064',
    'http://notes.rodeomasjid.org:8064',
    'http://notes.rodeomasjid.org',
    'https://notes.rodeomasjid.org',
    /^http:\/\/192\.168\.\d+\.\d+:8064$/,  // Allow local IP addresses
    /^http:\/\/10\.\d+\.\d+\.\d+:8064$/    // Allow private network IPs
  ],
  credentials: true
}))
app.use(express.json({ limit: '100mb' }))  // Increased from 50mb to 100mb
app.use(express.urlencoded({ limit: '100mb', extended: true }))  // Added for form data
app.use(morgan('dev'))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' })
})

// Settings endpoints
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings()

    // If no settings in database, return environment variables
    if (!settings || !settings.azure_endpoint) {
      console.log('[Settings] No database settings, loading from environment variables')
      return res.json({
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
        whisperDeployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper',
        gptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4'
      })
    }

    // Return database settings
    res.json({
      azureEndpoint: settings.azure_endpoint || '',
      apiKey: settings.api_key || '',
      apiVersion: settings.api_version || '2024-02-01',
      whisperDeployment: settings.whisper_deployment || 'whisper-1',
      gptDeployment: settings.gpt_deployment || 'gpt-4'
    })
  } catch (error) {
    console.error('[Settings] Get error:', error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
})

app.post('/api/settings', (req, res) => {
  try {
    db.saveSettings(req.body)
    console.log('[Settings] Saved successfully')
    res.json({ success: true })
  } catch (error) {
    console.error('[Settings] Save error:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// Project endpoints
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.getAllProjects().map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      lastModified: p.updated_at
    }))
    res.json(projects)
  } catch (error) {
    console.error('[Projects] List error:', error)
    res.status(500).json({ error: 'Failed to get projects' })
  }
})

app.get('/api/projects/:id', (req, res) => {
  try {
    const project = db.getProject(req.params.id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    res.json({
      id: project.id,
      name: project.name,
      transcript: project.transcript || '',
      summary: project.summary || '',
      tasks: project.tasks || [],
      meetings: project.meetings || [],
      createdAt: project.created_at,
      lastModified: project.updated_at
    })
  } catch (error) {
    console.error('[Projects] Get error:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
})

app.post('/api/projects', (req, res) => {
  try {
    db.saveProject(req.body)
    console.log('[Projects] Saved:', req.body.name)
    res.json({ success: true, id: req.body.id })
  } catch (error) {
    console.error('[Projects] Save error:', error)
    res.status(500).json({ error: 'Failed to save project' })
  }
})

app.delete('/api/projects/:id', (req, res) => {
  try {
    db.deleteProject(req.params.id)
    console.log('[Projects] Deleted:', req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error('[Projects] Delete error:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

// Export all data
app.get('/api/export', (req, res) => {
  try {
    const data = db.exportAll()
    res.json(data)
  } catch (error) {
    console.error('[Export] Error:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// Meeting endpoints
app.post('/api/meetings', (req, res) => {
  try {
    const { id, name, summary, transcript, createdAt, projectId } = req.body

    // Ensure meetings directory exists
    if (!fs.existsSync(MEETINGS_DIR)) {
      fs.mkdirSync(MEETINGS_DIR, { recursive: true })
      console.log('[Meetings] Created meetings directory:', MEETINGS_DIR)
    }

    // Create summary file
    const summaryFileName = `meeting-${id}-summary.md`
    const summaryFilePath = path.join(MEETINGS_DIR, summaryFileName)

    const summaryContent = `# ${name}

**Date:** ${new Date(createdAt).toLocaleDateString()}
**Time:** ${new Date(createdAt).toLocaleTimeString()}
**Project:** ${projectId || 'No project'}

---

${summary}

---

*Generated by Audio-to-Kanban App*
`

    fs.writeFileSync(summaryFilePath, summaryContent, 'utf8')
    console.log('[Meetings] Saved summary file:', summaryFileName)

    // Create transcript file (optional)
    let transcriptFilePath = null
    if (transcript && transcript.trim()) {
      const transcriptFileName = `meeting-${id}-transcript.txt`
      transcriptFilePath = path.join(MEETINGS_DIR, transcriptFileName)
      fs.writeFileSync(transcriptFilePath, transcript, 'utf8')
      console.log('[Meetings] Saved transcript file:', transcriptFileName)
    }

    // Save to database
    db.saveMeeting({
      id,
      projectId,
      name,
      summaryFile: summaryFilePath,
      transcriptFile: transcriptFilePath
    })

    res.json({
      success: true,
      summaryFile: summaryFilePath,
      message: `Meeting "${name}" saved as file`
    })
  } catch (error) {
    console.error('[Meetings] Save error:', error)
    res.status(500).json({ error: 'Failed to save meeting' })
  }
})

app.get('/api/meetings/:id/summary', (req, res) => {
  try {
    const summaryFileName = `meeting-${req.params.id}-summary.md`
    const summaryFilePath = path.join(MEETINGS_DIR, summaryFileName)

    if (!fs.existsSync(summaryFilePath)) {
      return res.status(404).json({ error: 'Meeting summary not found' })
    }

    const content = fs.readFileSync(summaryFilePath, 'utf8')
    res.json({ content })
  } catch (error) {
    console.error('[Meetings] Get summary error:', error)
    res.status(500).json({ error: 'Failed to get meeting summary' })
  }
})

app.delete('/api/meetings/:id', (req, res) => {
  try {
    const id = req.params.id

    // Get meeting info from database first
    const meeting = db.getMeeting(id)

    // Delete files if they exist
    if (meeting && meeting.summary_file && fs.existsSync(meeting.summary_file)) {
      fs.unlinkSync(meeting.summary_file)
      console.log('[Meetings] Deleted summary file:', meeting.summary_file)
    }

    if (meeting && meeting.transcript_file && fs.existsSync(meeting.transcript_file)) {
      fs.unlinkSync(meeting.transcript_file)
      console.log('[Meetings] Deleted transcript file:', meeting.transcript_file)
    }

    // Delete from database
    db.deleteMeeting(id)
    console.log('[Meetings] Deleted meeting from database:', id)

    res.json({ success: true })
  } catch (error) {
    console.error('[Meetings] Delete error:', error)
    res.status(500).json({ error: 'Failed to delete meeting files' })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API running on http://0.0.0.0:${PORT}`)
  console.log('[Server] Using SQLite database')
})
