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
  const hasLinkedTasks = taskColumns.some(col => col.name === 'linked_tasks')
  const hasAiCreatedLinks = taskColumns.some(col => col.name === 'ai_created_links')
  const hasAiDiscoveredLinks = taskColumns.some(col => col.name === 'ai_discovered_links')
  const hasRejectedAiLinks = taskColumns.some(col => col.name === 'rejected_ai_links')

  if (!hasDueDate) {
    db.exec('ALTER TABLE tasks ADD COLUMN due_date DATE')
  }

  if (!hasAssignee) {
    db.exec('ALTER TABLE tasks ADD COLUMN assignee TEXT')
  }

  if (!hasSubtasks) {
    db.exec('ALTER TABLE tasks ADD COLUMN subtasks TEXT')
  }

  if (!hasComments) {
    db.exec('ALTER TABLE tasks ADD COLUMN comments TEXT')
  }

  if (!hasLinkedTasks) {
    db.exec('ALTER TABLE tasks ADD COLUMN linked_tasks TEXT')
  }

  if (!hasAiCreatedLinks) {
    db.exec('ALTER TABLE tasks ADD COLUMN ai_created_links TEXT')
  }

  if (!hasAiDiscoveredLinks) {
    db.exec('ALTER TABLE tasks ADD COLUMN ai_discovered_links TEXT')
  }

  if (!hasRejectedAiLinks) {
    db.exec('ALTER TABLE tasks ADD COLUMN rejected_ai_links TEXT')
  }

  // Open Source version - no subscription fields needed

  // Add OIDC configuration columns to settings table
  const settingsColumns = db.prepare("PRAGMA table_info(settings)").all()
  const hasOidcEnabled = settingsColumns.some(col => col.name === 'oidc_enabled')
  const hasOidcClientId = settingsColumns.some(col => col.name === 'oidc_client_id')
  const hasOidcClientSecret = settingsColumns.some(col => col.name === 'oidc_client_secret')
  const hasOidcIssuer = settingsColumns.some(col => col.name === 'oidc_issuer')
  const hasOidcCallbackUrl = settingsColumns.some(col => col.name === 'oidc_callback_url')

  if (!hasOidcEnabled) {
    db.exec('ALTER TABLE settings ADD COLUMN oidc_enabled INTEGER DEFAULT 0')
  }

  if (!hasOidcClientId) {
    db.exec('ALTER TABLE settings ADD COLUMN oidc_client_id TEXT')
  }

  if (!hasOidcClientSecret) {
    db.exec('ALTER TABLE settings ADD COLUMN oidc_client_secret TEXT')
  }

  if (!hasOidcIssuer) {
    db.exec("ALTER TABLE settings ADD COLUMN oidc_issuer TEXT DEFAULT 'https://pocketid.app'")
  }

  if (!hasOidcCallbackUrl) {
    db.exec('ALTER TABLE settings ADD COLUMN oidc_callback_url TEXT')
  }

  // Migrate existing OIDC users if any (from old schema)
  try {
    const oldUsersCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'").get()
    if (!oldUsersCheck) {
      // Check if current users table has 'sub' column (old OIDC schema)
      const userColumns = db.prepare("PRAGMA table_info(users)").all()
      const hasSub = userColumns.some(col => col.name === 'sub')

      if (hasSub && !userColumns.some(col => col.name === 'auth_provider')) {
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
  } catch (indexErr) {
    // Indexes already exist or not needed
  }

  // Fix user_id data type mismatches (convert float strings like "2.0" back to integers)
  try {
    console.log('[Database] Fixing user_id data type mismatches...')

    // Fix projects table user_id format
    const projectsWithFloatIds = db.prepare("SELECT id, user_id FROM projects WHERE user_id LIKE '%.0'").all()
    for (const project of projectsWithFloatIds) {
      const fixedUserId = project.user_id.replace('.0', '')
      db.prepare('UPDATE projects SET user_id = ? WHERE id = ?').run(fixedUserId, project.id)
      console.log(`[Database] Fixed project ${project.id} user_id: ${project.user_id} -> ${fixedUserId}`)
    }

    // Fix meetings table user_id format
    const meetingsWithFloatIds = db.prepare("SELECT id, user_id FROM meetings WHERE user_id LIKE '%.0'").all()
    for (const meeting of meetingsWithFloatIds) {
      const fixedUserId = meeting.user_id.replace('.0', '')
      db.prepare('UPDATE meetings SET user_id = ? WHERE id = ?').run(fixedUserId, meeting.id)
      console.log(`[Database] Fixed meeting ${meeting.id} user_id: ${meeting.user_id} -> ${fixedUserId}`)
    }

    console.log('[Database] User ID format fix completed')
  } catch (userIdFixError) {
    console.log('[Database] User ID format fix not needed or already completed')
  }

  console.log('[Database] Migration completed successfully')
} catch (migrationError) {
  console.error('[Database] Migration error:', migrationError)
}

// Settings operations
// Get system-wide settings (OIDC settings are shared across all admins)
export const getSystemSettings = () => {
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
  const settings = stmt.get('system')

  // If no system settings exist, return defaults from environment variables
  if (!settings) {
    const enableOidc = process.env.ENABLE_OIDC === 'true' || process.env.ENABLE_OIDC === '1'
    return {
      user_id: 'system',
      oidc_issuer: process.env.POCKET_ID_ISSUER || 'https://pocketid.app',
      oidc_client_id: process.env.POCKET_ID_CLIENT_ID || '',
      oidc_client_secret: process.env.POCKET_ID_CLIENT_SECRET || '',
      oidc_enabled: enableOidc ? 1 : 0,
      oidc_callback_url: process.env.POCKET_ID_CALLBACK_URL || ''
    }
  }

  return settings
}

// Legacy function for user-specific settings (AI settings only now)
export const getSettings = (userId) => {
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
  const settings = stmt.get(userId)

  // Get system-wide OIDC settings
  const systemSettings = getSystemSettings()

  // If no user settings exist, return defaults with system OIDC settings
  if (!settings) {
    return {
      user_id: userId,
      azure_endpoint: '',
      api_key: '',
      api_version: '2024-02-01',
      whisper_deployment: 'whisper',
      gpt_deployment: 'gpt-4',
      // OIDC settings come from system settings
      oidc_issuer: systemSettings.oidc_issuer,
      oidc_client_id: systemSettings.oidc_client_id,
      oidc_client_secret: systemSettings.oidc_client_secret,
      oidc_enabled: systemSettings.oidc_enabled,
      oidc_callback_url: systemSettings.oidc_callback_url
    }
  }

  // Merge user settings with system OIDC settings
  return {
    ...settings,
    oidc_issuer: systemSettings.oidc_issuer,
    oidc_client_id: systemSettings.oidc_client_id,
    oidc_client_secret: systemSettings.oidc_client_secret,
    oidc_enabled: systemSettings.oidc_enabled,
    oidc_callback_url: systemSettings.oidc_callback_url
  }
}

export const saveSettings = (userId, settings) => {
  const existing = getSettings(userId)

  // Use environment variables as fallback for OIDC settings
  const oidcIssuer = settings.oidcIssuer || process.env.POCKET_ID_ISSUER || 'https://pocketid.app'
  const oidcClientId = settings.oidcClientId || process.env.POCKET_ID_CLIENT_ID || null
  const oidcClientSecret = settings.oidcClientSecret || process.env.POCKET_ID_CLIENT_SECRET || null

  if (existing && existing.id) {
    const stmt = db.prepare(`
      UPDATE settings
      SET azure_endpoint = ?, api_key = ?, api_version = ?,
          whisper_deployment = ?, gpt_deployment = ?,
          oidc_enabled = ?, oidc_client_id = ?, oidc_client_secret = ?,
          oidc_issuer = ?, oidc_callback_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `)
    stmt.run(
      settings.azureEndpoint,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment,
      settings.oidcEnabled ? 1 : 0,
      oidcClientId,
      oidcClientSecret,
      oidcIssuer,
      settings.oidcCallbackUrl || null,
      userId
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, azure_endpoint, api_key, api_version, whisper_deployment, gpt_deployment, oidc_enabled, oidc_client_id, oidc_client_secret, oidc_issuer, oidc_callback_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userId,
      settings.azureEndpoint,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment,
      settings.oidcEnabled ? 1 : 0,
      oidcClientId,
      oidcClientSecret,
      oidcIssuer,
      settings.oidcCallbackUrl || null
    )
  }
}

// Save system-wide settings (OIDC settings are shared across all admins)
export const saveSystemSettings = (settings) => {
  const existing = getSystemSettings()

  if (existing && existing.id) {
    const stmt = db.prepare(`
      UPDATE settings
      SET oidc_enabled = ?, oidc_client_id = ?, oidc_client_secret = ?,
          oidc_issuer = ?, oidc_callback_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `)
    stmt.run(
      settings.oidcEnabled ? 1 : 0,
      settings.oidcClientId,
      settings.oidcClientSecret,
      settings.oidcIssuer,
      settings.oidcCallbackUrl,
      'system'
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, oidc_enabled, oidc_client_id, oidc_client_secret, oidc_issuer, oidc_callback_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      'system',
      settings.oidcEnabled ? 1 : 0,
      settings.oidcClientId,
      settings.oidcClientSecret,
      settings.oidcIssuer,
      settings.oidcCallbackUrl
    )
  }
}

// Project operations
export const getAllProjects = (userId) => {
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
  return stmt.all(userIdStr)
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
      linkedTasks: task.linked_tasks ? JSON.parse(task.linked_tasks) : [],
      aiCreatedLinks: task.ai_created_links ? JSON.parse(task.ai_created_links) : [],
      aiDiscoveredLinks: task.ai_discovered_links ? JSON.parse(task.ai_discovered_links) : [],
      rejectedAiLinks: task.rejected_ai_links ? JSON.parse(task.rejected_ai_links) : [],
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
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const existing = getProject(project.id)

  if (existing) {
    const stmt = db.prepare(`
      UPDATE projects
      SET name = ?, transcript = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `)
    stmt.run(project.name, project.transcript || '', project.summary || '', project.id, userIdStr)
  } else {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, transcript, summary)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(project.id, userIdStr, project.name, project.transcript || '', project.summary || '')
  }

  // Save tasks if provided
  if (project.tasks && Array.isArray(project.tasks)) {

    // Delete existing tasks and insert new ones
    const deleteStmt = db.prepare('DELETE FROM tasks WHERE project_id = ?')
    deleteStmt.run(project.id)

    const insertStmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, subtasks, comments, linked_tasks, ai_created_links, ai_discovered_links, rejected_ai_links)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const task of project.tasks) {
      if (task.linkedTasks && task.linkedTasks.length > 0) {
        // Process linked tasks
      }
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
        JSON.stringify(task.comments || []),
        JSON.stringify(task.linkedTasks || []),
        JSON.stringify(task.aiCreatedLinks || []),
        JSON.stringify(task.aiDiscoveredLinks || []),
        JSON.stringify(task.rejectedAiLinks || [])
      )
    }

  } else {
    // No tasks to save
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
    INSERT OR REPLACE INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, subtasks, comments, linked_tasks, ai_created_links, ai_discovered_links, rejected_ai_links)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    JSON.stringify(task.comments || []),
    JSON.stringify(task.linkedTasks || []),
    JSON.stringify(task.aiCreatedLinks || []),
    JSON.stringify(task.aiDiscoveredLinks || []),
    JSON.stringify(task.rejectedAiLinks || [])
  )
}

export const deleteTask = (taskId) => {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  stmt.run(taskId)
}

// Meeting operations
export const saveMeeting = (userId, meeting) => {
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO meetings (id, user_id, project_id, name, summary_file, transcript_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    meeting.id,
    userIdStr,
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
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const stmt = db.prepare('SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC')
  return stmt.all(userIdStr)
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

  try {
    // Start transaction for complete data removal
    db.transaction(() => {
      console.log(`[Database] Deleting all data for user ${userId}`)

      // Get user's project IDs to delete associated tasks and meetings
      const userProjects = db.prepare('SELECT id FROM projects WHERE user_id = ?').all(userId)
      const projectIds = userProjects.map(p => p.id)

      if (projectIds.length > 0) {
        // Delete tasks for all user's projects
        const deleteTasksStmt = db.prepare(`DELETE FROM tasks WHERE project_id IN (${projectIds.map(() => '?').join(',')})`)
        deleteTasksStmt.run(...projectIds)
      }

      // Delete user's meetings
      const deleteMeetingsStmt = db.prepare('DELETE FROM meetings WHERE user_id = ?')
      deleteMeetingsStmt.run(userId)

      // Delete user's projects
      const deleteProjectsStmt = db.prepare('DELETE FROM projects WHERE user_id = ?')
      deleteProjectsStmt.run(userId)

      // Delete user's settings
      const deleteSettingsStmt = db.prepare('DELETE FROM settings WHERE user_id = ?')
      deleteSettingsStmt.run(userId)

      // Finally delete the user
      const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?')
      deleteUserStmt.run(userId)

    })()

    return true

  } catch (error) {
    console.error(`[Database] Error deleting user ${userId}:`, error)
    throw new Error(`Failed to delete user: ${error.message}`)
  }
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
