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

// Create users table with both local and OIDC auth support
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    email_verified INTEGER DEFAULT 0,
    name TEXT,
    picture TEXT,
    role TEXT CHECK(role IN ('admin','member')) DEFAULT 'member',
    auth_provider TEXT CHECK(auth_provider IN ('local','oidc')) DEFAULT 'local',
    password_hash TEXT,
    oidc_issuer TEXT,
    oidc_sub TEXT,
    active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

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

  // Migrate existing OIDC users if any (from old schema)
  try {
    const oldUsersCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'").get()
    if (!oldUsersCheck) {
      // Check if current users table has 'sub' column (old OIDC schema)
      const userColumns = db.prepare("PRAGMA table_info(users)").all()
      const hasSub = userColumns.some(col => col.name === 'sub')

      if (hasSub && !userColumns.some(col => col.name === 'auth_provider')) {
        console.log('[Database] Migrating old OIDC users to new schema')
        // Rename old table, recreate with new schema, migrate data
        db.exec('ALTER TABLE users RENAME TO users_old')
        db.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            email_verified INTEGER DEFAULT 0,
            name TEXT,
            picture TEXT,
            role TEXT CHECK(role IN ('admin','member')) DEFAULT 'member',
            auth_provider TEXT CHECK(auth_provider IN ('local','oidc')) DEFAULT 'local',
            password_hash TEXT,
            oidc_issuer TEXT,
            oidc_sub TEXT,
            active INTEGER DEFAULT 1,
            last_login TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `)

        // Migrate old OIDC users
        db.exec(`
          INSERT INTO users (email, name, picture, role, auth_provider, oidc_sub, oidc_issuer, last_login, created_at)
          SELECT email, name, picture,
                 CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END,
                 'oidc', sub, 'https://login.qureshi.io',
                 last_login, created_at
          FROM users_old
        `)

        console.log('[Database] Old users migrated, cleaning up')
        db.exec('DROP TABLE users_old')
      }
    }
  } catch (migErr) {
    console.log('[Database] User migration not needed or already completed')
  }

  // Create indexes after migration (ensuring columns exist)
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc ON users(oidc_issuer, oidc_sub) WHERE oidc_issuer IS NOT NULL AND oidc_sub IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
    `)
    console.log('[Database] User indexes created')
  } catch (indexErr) {
    console.log('[Database] Index creation skipped or already exists')
  }

  console.log('[Database] Migration completed successfully')
} catch (migrationError) {
  console.error('[Database] Migration error:', migrationError)
}

// Settings operations
export const getSettings = (userId) => {
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
  return stmt.get(userId)
}

export const saveSettings = (userId, settings) => {
  const existing = getSettings(userId)

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
      userId
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, azure_endpoint, api_key, api_version, whisper_deployment, gpt_deployment)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userId,
      settings.azureEndpoint,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment
    )
  }
}

// Project operations
export const getAllProjects = (userId) => {
  const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
  return stmt.all(userId)
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

export const saveProject = (userId, project) => {
  const existing = getProject(project.id)

  if (existing) {
    const stmt = db.prepare(`
      UPDATE projects
      SET name = ?, transcript = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `)
    stmt.run(project.name, project.transcript || '', project.summary || '', project.id, userId)
  } else {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, transcript, summary)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(project.id, userId, project.name, project.transcript || '', project.summary || '')
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
export const saveMeeting = (userId, meeting) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO meetings (id, user_id, project_id, name, summary_file, transcript_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    meeting.id,
    userId,
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

export const getAllMeetings = (userId) => {
  const stmt = db.prepare('SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC')
  return stmt.all(userId)
}

export const deleteMeeting = (meetingId) => {
  const stmt = db.prepare('DELETE FROM meetings WHERE id = ?')
  stmt.run(meetingId)
}

// User operations for local authentication
export const getUserById = (userId) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1')
  return stmt.get(userId)
}

export const getUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1')
  return stmt.get(email)
}

export const getUserByOIDC = (issuer, sub) => {
  const stmt = db.prepare('SELECT * FROM users WHERE oidc_issuer = ? AND oidc_sub = ? AND active = 1')
  return stmt.get(issuer, sub)
}

export const createUser = (userData) => {
  const stmt = db.prepare(`
    INSERT INTO users (
      email, email_verified, name, picture, role, auth_provider,
      password_hash, oidc_issuer, oidc_sub, last_login
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  const result = stmt.run(
    userData.email || null,
    userData.email_verified ? 1 : 0,
    userData.name || null,
    userData.picture || null,
    userData.role || 'member',
    userData.auth_provider || 'local',
    userData.password_hash || null,
    userData.oidc_issuer || null,
    userData.oidc_sub || null
  )

  return getUserById(result.lastInsertRowid)
}

export const updateUser = (userId, updates) => {
  const fields = []
  const values = []

  if (updates.email !== undefined) {
    fields.push('email = ?')
    values.push(updates.email)
  }
  if (updates.email_verified !== undefined) {
    fields.push('email_verified = ?')
    values.push(updates.email_verified ? 1 : 0)
  }
  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.picture !== undefined) {
    fields.push('picture = ?')
    values.push(updates.picture)
  }
  if (updates.role !== undefined) {
    fields.push('role = ?')
    values.push(updates.role)
  }
  if (updates.password_hash !== undefined) {
    fields.push('password_hash = ?')
    values.push(updates.password_hash)
  }
  if (updates.oidc_issuer !== undefined) {
    fields.push('oidc_issuer = ?')
    values.push(updates.oidc_issuer)
  }
  if (updates.oidc_sub !== undefined) {
    fields.push('oidc_sub = ?')
    values.push(updates.oidc_sub)
  }
  if (updates.active !== undefined) {
    fields.push('active = ?')
    values.push(updates.active ? 1 : 0)
  }

  if (fields.length === 0) return getUserById(userId)

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(userId)

  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
  stmt.run(...values)

  return getUserById(userId)
}

export const updateUserLogin = (userId) => {
  const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(userId)
}

export const getAllUsers = () => {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC')
  return stmt.all()
}

export const deleteUser = (userId) => {
  // Check if this is the last admin
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1").get()
  const user = getUserById(userId)

  if (user && user.role === 'admin' && adminCount.count === 1) {
    throw new Error('Cannot delete the last admin user')
  }

  const stmt = db.prepare('UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(userId)
  return true
}

// Check if any users exist (for first-run setup)
export const hasUsers = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE active = 1')
  const result = stmt.get()
  return result.count > 0
}

// Export all data
export const exportAll = (userId) => {
  return {
    settings: getSettings(userId),
    projects: getAllProjects(userId).map(p => getProject(p.id))
  }
}

export default db
