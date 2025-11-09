import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../storage/app.db')

// Ensure storage directory exists
const storageDir = path.dirname(DB_PATH)
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true })
  console.log('[Database] Created storage directory:', storageDir)
}

// Initialize database
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

console.log('[Database] Initialized at:', DB_PATH)

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    azure_endpoint TEXT,
    api_key TEXT,
    api_version TEXT,
    whisper_deployment TEXT,
    gpt_deployment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    transcript TEXT,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    assignee TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    project_id TEXT,
    name TEXT NOT NULL,
    summary_file TEXT,
    transcript_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
  CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id);
`)

console.log('[Database] Tables created/verified')

// Migration: Add new columns if they don't exist
try {
  // Check if due_date column exists in tasks table
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all()
  const hasDueDate = taskColumns.some(col => col.name === 'due_date')
  const hasAssignee = taskColumns.some(col => col.name === 'assignee')
  const hasSubtasks = taskColumns.some(col => col.name === 'subtasks')
  const hasComments = taskColumns.some(col => col.name === 'comments')

  if (!hasDueDate) {
    console.log('[Database] Adding due_date column to tasks table')
    db.exec('ALTER TABLE tasks ADD COLUMN due_date DATE')
  }

  if (!hasAssignee) {
    console.log('[Database] Adding assignee column to tasks table')
    db.exec('ALTER TABLE tasks ADD COLUMN assignee TEXT')
  }

  if (!hasSubtasks) {
    console.log('[Database] Adding subtasks column to tasks table')
    db.exec('ALTER TABLE tasks ADD COLUMN subtasks TEXT')
  }

  if (!hasComments) {
    console.log('[Database] Adding comments column to tasks table')
    db.exec('ALTER TABLE tasks ADD COLUMN comments TEXT')
  }

  console.log('[Database] Migration completed successfully')
} catch (migrationError) {
  console.error('[Database] Migration error:', migrationError)
}

// Settings operations
export const getSettings = () => {
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
  return stmt.get('default')
}

export const saveSettings = (settings) => {
  const existing = getSettings()

  if (existing) {
    const stmt = db.prepare(`
      UPDATE settings
      SET azure_endpoint = ?, api_key = ?, api_version = ?,
          whisper_deployment = ?, gpt_deployment = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `)
    stmt.run(
      settings.azureEndpoint,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment,
      'default'
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, azure_endpoint, api_key, api_version, whisper_deployment, gpt_deployment)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      'default',
      settings.azureEndpoint,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment
    )
  }
}

// Project operations
export const getAllProjects = () => {
  const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
  return stmt.all('default')
}

export const getProject = (projectId) => {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
  const project = stmt.get(projectId)

  if (project) {
    // Get tasks for this project
    const tasksStmt = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC')
    const tasks = tasksStmt.all(projectId)

    // Convert database format to frontend format for tasks
    project.tasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      dueDate: task.due_date || null,
      assignee: task.assignee || null,
      subtasks: task.subtasks ? JSON.parse(task.subtasks) : [],
      comments: task.comments ? JSON.parse(task.comments) : [],
      createdAt: task.created_at,
      projectId: task.project_id
    }))

    // Get meetings for this project
    const meetingsStmt = db.prepare('SELECT * FROM meetings WHERE project_id = ? ORDER BY created_at DESC')
    const meetings = meetingsStmt.all(projectId)

    // Convert database format to frontend format for meetings
    project.meetings = meetings.map(meeting => ({
      id: meeting.id,
      name: meeting.name,
      transcript: '', // We'll load this from file if needed
      summary: '', // We'll load this from file if needed
      createdAt: meeting.created_at,
      projectId: meeting.project_id,
      summaryFile: meeting.summary_file
    }))
  }

  return project
}

export const saveProject = (project) => {
  const existing = getProject(project.id)

  if (existing) {
    const stmt = db.prepare(`
      UPDATE projects
      SET name = ?, transcript = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(project.name, project.transcript || '', project.summary || '', project.id)
  } else {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, transcript, summary)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(project.id, 'default', project.name, project.transcript || '', project.summary || '')
  }

  // Save tasks if provided
  if (project.tasks && Array.isArray(project.tasks)) {
    console.log('[Database] Saving', project.tasks.length, 'tasks for project', project.id)

    // Delete existing tasks and insert new ones
    const deleteStmt = db.prepare('DELETE FROM tasks WHERE project_id = ?')
    deleteStmt.run(project.id)

    const insertStmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, subtasks, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const task of project.tasks) {
      console.log('[Database] Saving task:', task.title)
      insertStmt.run(
        task.id,
        project.id,
        task.title,
        task.description || '',
        task.status || 'todo',
        task.priority || 'medium',
        task.dueDate || null,
        task.assignee || null,
        JSON.stringify(task.subtasks || []),
        JSON.stringify(task.comments || [])
      )
    }

    console.log('[Database] ✓ All tasks saved successfully')
  } else {
    console.log('[Database] No tasks to save for project', project.id)
  }

  // Note: Meetings are saved separately via /api/meetings endpoint
}

export const deleteProject = (projectId) => {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
  stmt.run(projectId)
}

// Task operations
export const saveTask = (task) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, subtasks, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    task.id,
    task.projectId,
    task.title,
    task.description || '',
    task.status || 'todo',
    task.priority || 'medium',
    task.dueDate || null,
    task.assignee || null,
    JSON.stringify(task.subtasks || []),
    JSON.stringify(task.comments || [])
  )
}

export const deleteTask = (taskId) => {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  stmt.run(taskId)
}

// Meeting operations
export const saveMeeting = (meeting) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO meetings (id, user_id, project_id, name, summary_file, transcript_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    meeting.id,
    'default',
    meeting.projectId,
    meeting.name,
    meeting.summaryFile || null,
    meeting.transcriptFile || null
  )
}

export const getMeeting = (meetingId) => {
  const stmt = db.prepare('SELECT * FROM meetings WHERE id = ?')
  return stmt.get(meetingId)
}

export const getAllMeetings = () => {
  const stmt = db.prepare('SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC')
  return stmt.all('default')
}

export const deleteMeeting = (meetingId) => {
  const stmt = db.prepare('DELETE FROM meetings WHERE id = ?')
  stmt.run(meetingId)
}

// Export all data
export const exportAll = () => {
  return {
    settings: getSettings(),
    projects: getAllProjects().map(p => getProject(p.id))
  }
}

export default db
