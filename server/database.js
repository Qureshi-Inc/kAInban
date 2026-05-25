import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

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
    provider TEXT DEFAULT 'azure',
    azure_endpoint TEXT,
    openai_base_url TEXT,
    api_key TEXT,
    api_version TEXT,
    whisper_deployment TEXT,
    gpt_deployment TEXT,
    openai_whisper_model TEXT,
    openai_gpt_model TEXT,
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

// Add meeting_id column to tasks table if it doesn't exist
try {
  db.exec('ALTER TABLE tasks ADD COLUMN meeting_id TEXT;')
  console.log('[Database] Added meeting_id column to tasks table')
} catch (error) {
  // Column already exists, ignore
  if (!error.message.includes('duplicate column name')) {
    console.error('[Database] Error adding meeting_id column:', error)
  }
}

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

// Create analytics insights table for caching
db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project_id TEXT,  -- NULL means "all projects"
    insights TEXT NOT NULL,
    task_count INTEGER,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, project_id)  -- One cache entry per user per project
  );
`)

// Create task change tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS task_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    project_id TEXT,           -- Denormalized for activity queries (especially after task deletion)
    user_id TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', 'priority_changed', etc.
    field_name TEXT,           -- specific field that changed (title, description, priority, etc.)
    old_value TEXT,            -- previous value (JSON for complex fields)
    new_value TEXT,            -- new value (JSON for complex fields)
    metadata TEXT,             -- additional context (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Create task comments table (separate from change tracking)
db.exec(`
  CREATE TABLE IF NOT EXISTS task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL,  -- Display name for the comment author
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'user', -- 'user', 'ai_update', 'system'
    metadata TEXT,             -- additional data (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Create multi-tenant tables (only used when MULTITENANCY_ENABLED=true)
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,     -- e.g., 'acme' for acme.kainban.com
    custom_domain TEXT,        -- e.g., 'tasks.acme.com'
    plan TEXT DEFAULT 'starter', -- 'starter', 'professional', 'enterprise'
    max_users INTEGER DEFAULT 5,
    settings TEXT,             -- JSON for tenant-specific settings
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Create invite tokens table for tenant invitations
db.exec(`
  CREATE TABLE IF NOT EXISTS invite_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,           -- User who created the invite
    invitee_email TEXT NOT NULL,        -- Email of person being invited
    role TEXT DEFAULT 'user',           -- 'admin', 'user', 'viewer'
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,             -- 0 = unused, 1 = used
    used_by TEXT,                       -- User ID who used the token
    used_at DATETIME,                   -- When token was used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (inviter_id) REFERENCES users(id)
  );
`)

// Add tenant columns to existing tables if multi-tenancy is enabled
// These migrations will run automatically when MULTITENANCY_ENABLED=true

// Migration: Add new columns if they don't exist
try {
  // Check if due_date column exists in tasks table
  const taskColumns = db.prepare('PRAGMA table_info(tasks)').all()
  const hasDueDate = taskColumns.some(col => col.name === 'due_date')
  const hasAssignee = taskColumns.some(col => col.name === 'assignee')
  const hasSubtasks = taskColumns.some(col => col.name === 'subtasks')
  const hasComments = taskColumns.some(col => col.name === 'comments')
  const hasLinkedTasks = taskColumns.some(col => col.name === 'linked_tasks')
  const hasAiCreatedLinks = taskColumns.some(
    col => col.name === 'ai_created_links'
  )
  const hasAiDiscoveredLinks = taskColumns.some(
    col => col.name === 'ai_discovered_links'
  )
  const hasRejectedAiLinks = taskColumns.some(
    col => col.name === 'rejected_ai_links'
  )

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
  const settingsColumns = db.prepare('PRAGMA table_info(settings)').all()
  const hasOidcEnabled = settingsColumns.some(
    col => col.name === 'oidc_enabled'
  )
  const hasOidcClientId = settingsColumns.some(
    col => col.name === 'oidc_client_id'
  )
  const hasOidcClientSecret = settingsColumns.some(
    col => col.name === 'oidc_client_secret'
  )
  const hasOidcIssuer = settingsColumns.some(col => col.name === 'oidc_issuer')
  const hasOidcCallbackUrl = settingsColumns.some(
    col => col.name === 'oidc_callback_url'
  )

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
    db.exec(
      "ALTER TABLE settings ADD COLUMN oidc_issuer TEXT DEFAULT 'https://pocketid.app'"
    )
  }

  if (!hasOidcCallbackUrl) {
    db.exec('ALTER TABLE settings ADD COLUMN oidc_callback_url TEXT')
  }

  // Add multi-provider AI columns
  const hasProvider = settingsColumns.some(col => col.name === 'provider')
  const hasOpenaiBaseUrl = settingsColumns.some(
    col => col.name === 'openai_base_url'
  )
  const hasOpenaiWhisperModel = settingsColumns.some(
    col => col.name === 'openai_whisper_model'
  )
  const hasOpenaiGptModel = settingsColumns.some(
    col => col.name === 'openai_gpt_model'
  )

  if (!hasProvider) {
    db.exec("ALTER TABLE settings ADD COLUMN provider TEXT DEFAULT 'azure'")
  }

  if (!hasOpenaiBaseUrl) {
    db.exec('ALTER TABLE settings ADD COLUMN openai_base_url TEXT')
  }

  if (!hasOpenaiWhisperModel) {
    db.exec('ALTER TABLE settings ADD COLUMN openai_whisper_model TEXT')
  }

  if (!hasOpenaiGptModel) {
    db.exec('ALTER TABLE settings ADD COLUMN openai_gpt_model TEXT')
  }

  // Multi-tenant migrations - Add tenant_id to all tables when enabled
  const multiTenancyEnabled = process.env.MULTITENANCY_ENABLED === 'true'

  if (multiTenancyEnabled) {
    console.log('[Database] Multi-tenancy enabled - running tenant migrations')

    // Add tenant_id to users table
    const usersColumns = db.prepare('PRAGMA table_info(users)').all()
    const userHasTenantId = usersColumns.some(col => col.name === 'tenant_id')
    if (!userHasTenantId) {
      db.exec('ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT NULL')
      console.log('[Database] Added tenant_id to users table')
    }

    // Add tenant_id to projects table
    const projectsColumns = db.prepare('PRAGMA table_info(projects)').all()
    const projectsHasTenantId = projectsColumns.some(col => col.name === 'tenant_id')
    if (!projectsHasTenantId) {
      db.exec('ALTER TABLE projects ADD COLUMN tenant_id TEXT DEFAULT NULL')
      console.log('[Database] Added tenant_id to projects table')
    }

    // Add tenant_id to tasks table
    const tasksHasTenantId = taskColumns.some(col => col.name === 'tenant_id')
    if (!tasksHasTenantId) {
      db.exec('ALTER TABLE tasks ADD COLUMN tenant_id TEXT DEFAULT NULL')
      console.log('[Database] Added tenant_id to tasks table')
    }

    // Add tenant_id to meetings table
    const meetingsColumns = db.prepare('PRAGMA table_info(meetings)').all()
    const meetingsHasTenantId = meetingsColumns.some(col => col.name === 'tenant_id')
    if (!meetingsHasTenantId) {
      db.exec('ALTER TABLE meetings ADD COLUMN tenant_id TEXT DEFAULT NULL')
      console.log('[Database] Added tenant_id to meetings table')
    }

    // Add tenant_id to settings table
    const settingsHasTenantId = settingsColumns.some(col => col.name === 'tenant_id')
    if (!settingsHasTenantId) {
      db.exec('ALTER TABLE settings ADD COLUMN tenant_id TEXT DEFAULT NULL')
      console.log('[Database] Added tenant_id to settings table')
    }

    // Create indices for tenant isolation
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_tenant ON meetings(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
    `)
    console.log('[Database] Created tenant isolation indices')
  }

  // Migrate existing OIDC users if any (from old schema)
  try {
    const oldUsersCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'"
      )
      .get()
    if (!oldUsersCheck) {
      // Check if current users table has 'sub' column (old OIDC schema)
      const userColumns = db.prepare('PRAGMA table_info(users)').all()
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
    const projectsWithFloatIds = db
      .prepare("SELECT id, user_id FROM projects WHERE user_id LIKE '%.0'")
      .all()
    for (const project of projectsWithFloatIds) {
      const fixedUserId = project.user_id.replace('.0', '')
      db.prepare('UPDATE projects SET user_id = ? WHERE id = ?').run(
        fixedUserId,
        project.id
      )
      console.log(
        `[Database] Fixed project ${project.id} user_id: ${project.user_id} -> ${fixedUserId}`
      )
    }

    // Fix meetings table user_id format
    const meetingsWithFloatIds = db
      .prepare("SELECT id, user_id FROM meetings WHERE user_id LIKE '%.0'")
      .all()
    for (const meeting of meetingsWithFloatIds) {
      const fixedUserId = meeting.user_id.replace('.0', '')
      db.prepare('UPDATE meetings SET user_id = ? WHERE id = ?').run(
        fixedUserId,
        meeting.id
      )
      console.log(
        `[Database] Fixed meeting ${meeting.id} user_id: ${meeting.user_id} -> ${fixedUserId}`
      )
    }

    console.log('[Database] User ID format fix completed')
  } catch (userIdFixError) {
    console.log('[Database] User ID format fix not needed or already completed')
  }

  // Migration: Add project_id to task_changes for better activity tracking
  try {
    const taskChangesColumns = db
      .prepare('PRAGMA table_info(task_changes)')
      .all()
    const hasProjectId = taskChangesColumns.some(
      col => col.name === 'project_id'
    )

    if (!hasProjectId) {
      console.log('[Database] Adding project_id to task_changes...')

      // Add the column
      db.exec('ALTER TABLE task_changes ADD COLUMN project_id TEXT')

      // Populate existing records by joining with tasks table
      const updateStmt = db.prepare(`
        UPDATE task_changes
        SET project_id = (
          SELECT t.project_id
          FROM tasks t
          WHERE t.id = task_changes.task_id
        )
        WHERE task_id IS NOT NULL
      `)
      updateStmt.run()

      console.log('[Database] project_id added and populated in task_changes')
    }
  } catch (projectIdError) {
    console.log('[Database] project_id migration error:', projectIdError)
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
    const enableOidc =
      process.env.ENABLE_OIDC === 'true' || process.env.ENABLE_OIDC === '1'
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
export const getSettings = userId => {
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
  const settings = stmt.get(userId)

  // Get system-wide OIDC settings
  const systemSettings = getSystemSettings()

  // If no user settings exist, return defaults with system OIDC settings
  if (!settings) {
    return {
      user_id: userId,
      provider: 'azure',
      azure_endpoint: '',
      openai_base_url: 'https://api.openai.com/v1',
      api_key: '',
      api_version: '2024-02-01',
      whisper_deployment: 'whisper',
      gpt_deployment: 'gpt-4',
      openai_whisper_model: 'whisper-1',
      openai_gpt_model: 'gpt-4o',
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
  const oidcIssuer =
    settings.oidcIssuer ||
    process.env.POCKET_ID_ISSUER ||
    'https://pocketid.app'
  const oidcClientId =
    settings.oidcClientId || process.env.POCKET_ID_CLIENT_ID || null
  const oidcClientSecret =
    settings.oidcClientSecret || process.env.POCKET_ID_CLIENT_SECRET || null

  const provider = settings.provider === 'openai' ? 'openai' : 'azure'
  const openaiBaseUrl = settings.openaiBaseUrl || null
  const openaiWhisperModel = settings.openaiWhisperModel || null
  const openaiGptModel = settings.openaiGptModel || null

  if (existing && existing.id) {
    const stmt = db.prepare(`
      UPDATE settings
      SET provider = ?, azure_endpoint = ?, openai_base_url = ?,
          api_key = ?, api_version = ?,
          whisper_deployment = ?, gpt_deployment = ?,
          openai_whisper_model = ?, openai_gpt_model = ?,
          oidc_enabled = ?, oidc_client_id = ?, oidc_client_secret = ?,
          oidc_issuer = ?, oidc_callback_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `)
    stmt.run(
      provider,
      settings.azureEndpoint || null,
      openaiBaseUrl,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment,
      openaiWhisperModel,
      openaiGptModel,
      settings.oidcEnabled ? 1 : 0,
      oidcClientId,
      oidcClientSecret,
      oidcIssuer,
      settings.oidcCallbackUrl || null,
      userId
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, provider, azure_endpoint, openai_base_url, api_key, api_version, whisper_deployment, gpt_deployment, openai_whisper_model, openai_gpt_model, oidc_enabled, oidc_client_id, oidc_client_secret, oidc_issuer, oidc_callback_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userId,
      provider,
      settings.azureEndpoint || null,
      openaiBaseUrl,
      settings.apiKey,
      settings.apiVersion,
      settings.whisperDeployment,
      settings.gptDeployment,
      openaiWhisperModel,
      openaiGptModel,
      settings.oidcEnabled ? 1 : 0,
      oidcClientId,
      oidcClientSecret,
      oidcIssuer,
      settings.oidcCallbackUrl || null
    )
  }
}

// Save system-wide settings (OIDC settings are shared across all admins)
export const saveSystemSettings = settings => {
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
export const getAllProjects = userId => {
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const stmt = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
  )
  return stmt.all(userIdStr)
}

export const getProject = projectId => {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
  const project = stmt.get(projectId)

  if (project) {
    // Get tasks for this project
    const tasksStmt = db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC'
    )
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
      aiCreatedLinks: task.ai_created_links
        ? JSON.parse(task.ai_created_links)
        : [],
      aiDiscoveredLinks: task.ai_discovered_links
        ? JSON.parse(task.ai_discovered_links)
        : [],
      rejectedAiLinks: task.rejected_ai_links
        ? JSON.parse(task.rejected_ai_links)
        : [],
      createdAt: task.created_at,
      projectId: task.project_id,
      meetingId: task.meeting_id || null
    }))

    // Get meetings for this project
    const meetingsStmt = db.prepare(
      'SELECT * FROM meetings WHERE project_id = ? ORDER BY created_at DESC'
    )
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
    stmt.run(
      project.name,
      project.transcript || '',
      project.summary || '',
      project.id,
      userIdStr
    )
  } else {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, transcript, summary)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(
      project.id,
      userIdStr,
      project.name,
      project.transcript || '',
      project.summary || ''
    )
  }

  // Save tasks if provided with change tracking
  if (project.tasks && Array.isArray(project.tasks)) {
    // Get existing tasks to compare for changes
    const existingProject = getProject(project.id)
    const existingTasks = existingProject?.tasks || []

    // Create maps for easy lookup
    const existingTasksMap = new Map(existingTasks.map(t => [t.id, t]))
    const newTasksMap = new Map(project.tasks.map(t => [t.id, t]))

    const insertStmt = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, subtasks, comments, linked_tasks, ai_created_links, ai_discovered_links, rejected_ai_links, meeting_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const updateStmt = db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?, due_date = ?, assignee = ?,
        subtasks = ?, comments = ?, linked_tasks = ?, ai_created_links = ?,
        ai_discovered_links = ?, rejected_ai_links = ?, meeting_id = ?
      WHERE id = ?
    `)

    for (const task of project.tasks) {
      const existingTask = existingTasksMap.get(task.id)

      if (existingTask) {
        // Update existing task (preserves AI comments via foreign key)
        updateStmt.run(
          task.title,
          task.description || '',
          task.status || 'todo',
          task.priority || 'medium',
          task.dueDate || null,
          // Handle both assignees array and legacy assignee field
          (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0)
            ? task.assignees.join(', ')
            : (task.assignee || null),
          JSON.stringify(task.subtasks || []),
          JSON.stringify(task.comments || []),
          JSON.stringify(task.linkedTasks || []),
          JSON.stringify(task.aiCreatedLinks || []),
          JSON.stringify(task.aiDiscoveredLinks || []),
          JSON.stringify(task.rejectedAiLinks || []),
          task.meetingId || null,
          task.id
        )
      } else {
        // Insert new task
        insertStmt.run(
          task.id,
          project.id,
          task.title,
          task.description || '',
          task.status || 'todo',
          task.priority || 'medium',
          task.dueDate || null,
          // Handle both assignees array and legacy assignee field
          (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0)
            ? task.assignees.join(', ')
            : (task.assignee || null),
          JSON.stringify(task.subtasks || []),
          JSON.stringify(task.comments || []),
          JSON.stringify(task.linkedTasks || []),
          JSON.stringify(task.aiCreatedLinks || []),
          JSON.stringify(task.aiDiscoveredLinks || []),
          JSON.stringify(task.rejectedAiLinks || []),
          task.meetingId || null
        )
      }

      // Record changes if task existed before
      if (existingTask) {
        // Check for status change
        if (existingTask.status !== task.status) {
          console.log(
            '[saveProject] Recording status change for task:',
            task.id,
            'from',
            existingTask.status,
            'to',
            task.status
          )
          if (!task.id) {
            console.error(
              '[saveProject] ERROR: task.id is null/undefined for status change!'
            )
            console.error('[saveProject] Task object:', task)
          }
          recordTaskChange(
            task.id,
            userIdStr,
            'status_changed',
            'status',
            existingTask.status,
            task.status,
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for priority change
        if (existingTask.priority !== task.priority) {
          recordTaskChange(
            task.id,
            userIdStr,
            'priority_changed',
            'priority',
            existingTask.priority,
            task.priority,
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for title change
        if (existingTask.title !== task.title) {
          recordTaskChange(
            task.id,
            userIdStr,
            'title_changed',
            'title',
            existingTask.title,
            task.title,
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for description change
        if (existingTask.description !== (task.description || '')) {
          recordTaskChange(
            task.id,
            userIdStr,
            'description_changed',
            'description',
            existingTask.description,
            task.description || '',
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for assignees change (handle both legacy assignee and new assignees array)
        const existingAssignees =
          existingTask.assignees && Array.isArray(existingTask.assignees)
            ? existingTask.assignees
            : existingTask.assignee
              ? [existingTask.assignee]
              : []
        const newAssignees =
          task.assignees && Array.isArray(task.assignees)
            ? task.assignees
            : task.assignee
              ? [task.assignee]
              : []

        if (
          JSON.stringify(existingAssignees.sort()) !==
          JSON.stringify(newAssignees.sort())
        ) {
          recordTaskChange(
            task.id,
            userIdStr,
            'assignees_changed',
            'assignees',
            existingAssignees.join(', ') || null,
            newAssignees.join(', ') || null,
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for due date change
        if (existingTask.dueDate !== task.dueDate) {
          recordTaskChange(
            task.id,
            userIdStr,
            'due_date_changed',
            'dueDate',
            existingTask.dueDate,
            task.dueDate,
            {
              source: 'task_update',
              taskTitle: task.title || existingTask.title
            }
          )
        }

        // Check for subtask changes (completion status changes)
        const existingSubtasks = existingTask.subtasks
          ? (typeof existingTask.subtasks === 'string' ? JSON.parse(existingTask.subtasks) : existingTask.subtasks)
          : []
        const newSubtasks = task.subtasks || []

        // Compare subtask completion states
        const existingCompletionMap = {}
        const newCompletionMap = {}

        existingSubtasks.forEach(subtask => {
          existingCompletionMap[subtask.text] = subtask.completed || false
        })

        newSubtasks.forEach(subtask => {
          newCompletionMap[subtask.text] = subtask.completed || false
        })

        // Find completed or uncompleted subtasks
        const completedSubtasks = []
        const uncompletedSubtasks = []

        Object.keys(newCompletionMap).forEach(subtaskText => {
          const wasCompleted = existingCompletionMap[subtaskText] || false
          const isCompleted = newCompletionMap[subtaskText] || false

          if (!wasCompleted && isCompleted) {
            completedSubtasks.push(subtaskText)
          } else if (wasCompleted && !isCompleted) {
            uncompletedSubtasks.push(subtaskText)
          }
        })

        // Record subtask completion activities
        completedSubtasks.forEach(subtaskText => {
          recordTaskChange(
            task.id,
            userIdStr,
            'subtask_completed',
            'subtasks',
            `Subtask incomplete: ${subtaskText}`,
            `Subtask completed: ${subtaskText}`,
            {
              source: 'subtask_completion',
              taskTitle: task.title || existingTask.title,
              subtaskText
            }
          )
        })

        uncompletedSubtasks.forEach(subtaskText => {
          recordTaskChange(
            task.id,
            userIdStr,
            'subtask_uncompleted',
            'subtasks',
            `Subtask completed: ${subtaskText}`,
            `Subtask incomplete: ${subtaskText}`,
            {
              source: 'subtask_completion',
              taskTitle: task.title || existingTask.title,
              subtaskText
            }
          )
        })

        // Don't record generic "updated" entries since we have specific change records
      } else {
        // Record task creation
        recordTaskChange(task.id, userIdStr, 'created', null, null, null, {
          source: 'task_creation',
          taskTitle: task.title,
          status: task.status,
          priority: task.priority
        })
      }
    }

    // Check for deleted tasks
    for (const existingTask of existingTasks) {
      if (!newTasksMap.has(existingTask.id)) {
        // Task was deleted
        recordTaskChange(
          existingTask.id,
          userIdStr,
          'deleted',
          null,
          null,
          null,
          {
            source: 'task_deletion',
            taskTitle: existingTask.title
          }
        )

        // Delete the task from database
        const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?')
        deleteStmt.run(existingTask.id)
      }
    }
  } else {
    // No tasks to save - if there were existing tasks, they're being deleted
    const existingProject = getProject(project.id)
    if (existingProject?.tasks && existingProject.tasks.length > 0) {
      for (const task of existingProject.tasks) {
        recordTaskChange(task.id, userIdStr, 'deleted', null, null, null, {
          source: 'project_clear',
          taskTitle: task.title
        })
      }
      // Delete all tasks for this project
      const deleteStmt = db.prepare('DELETE FROM tasks WHERE project_id = ?')
      deleteStmt.run(project.id)
    }
  }

  // Note: Meetings are saved separately via /api/meetings endpoint
}

export const deleteProject = projectId => {
  try {
    // Start transaction for atomic deletion
    db.exec('BEGIN TRANSACTION')

    // Delete in order of foreign key dependencies (same as deleteAllProjects):
    // 1. Delete task comments (references tasks)
    const deleteTaskCommentsStmt = db.prepare(`
      DELETE FROM task_comments WHERE task_id IN (
        SELECT id FROM tasks WHERE project_id = ?
      )
    `)
    deleteTaskCommentsStmt.run(projectId)

    // 2. Delete task changes/activity (references tasks)
    const deleteTaskChangesStmt = db.prepare(`
      DELETE FROM task_changes WHERE task_id IN (
        SELECT id FROM tasks WHERE project_id = ?
      )
    `)
    deleteTaskChangesStmt.run(projectId)

    // 3. Delete analytics insights (references project)
    const deleteAnalyticsStmt = db.prepare(
      'DELETE FROM analytics_insights WHERE project_id = ?'
    )
    deleteAnalyticsStmt.run(projectId)

    // 4. Delete meetings (references project)
    const deleteMeetingsStmt = db.prepare(
      'DELETE FROM meetings WHERE project_id = ?'
    )
    deleteMeetingsStmt.run(projectId)

    // 5. Delete tasks (references project)
    const deleteTasksStmt = db.prepare('DELETE FROM tasks WHERE project_id = ?')
    deleteTasksStmt.run(projectId)

    // 6. Finally delete the project
    const deleteProjectStmt = db.prepare('DELETE FROM projects WHERE id = ?')
    deleteProjectStmt.run(projectId)

    // Commit transaction
    db.exec('COMMIT')

    console.log(
      `[Database] Successfully deleted project and all related data: ${projectId}`
    )
  } catch (error) {
    // Rollback on error
    try {
      db.exec('ROLLBACK')
    } catch (rollbackError) {
      console.error('[Database] Rollback error:', rollbackError)
    }
    console.error(`[Database] Error deleting project ${projectId}:`, error)
    throw error
  }
}

export const deleteAllProjects = userId => {
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)

  try {
    // Start transaction
    db.exec('BEGIN TRANSACTION')

    // Delete in order of foreign key dependencies:
    // 1. Delete task comments (references tasks)
    const deleteTaskCommentsStmt = db.prepare(`
      DELETE FROM task_comments WHERE task_id IN (
        SELECT id FROM tasks WHERE project_id IN (
          SELECT id FROM projects WHERE user_id = ?
        )
      )
    `)
    deleteTaskCommentsStmt.run(userIdStr)

    // 2. Delete task changes logs (references tasks)
    const deleteTaskChangesStmt = db.prepare(`
      DELETE FROM task_changes WHERE task_id IN (
        SELECT id FROM tasks WHERE project_id IN (
          SELECT id FROM projects WHERE user_id = ?
        )
      )
    `)
    deleteTaskChangesStmt.run(userIdStr)

    // 3. Delete analytics insights entries for user's projects
    const deleteAnalyticsStmt = db.prepare(`
      DELETE FROM analytics_insights WHERE user_id = ?
    `)
    deleteAnalyticsStmt.run(userIdStr)

    // 4. Delete meetings (references projects, but has ON DELETE SET NULL)
    const deleteMeetingsStmt = db.prepare(
      'DELETE FROM meetings WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)'
    )
    deleteMeetingsStmt.run(userIdStr)

    // 5. Delete tasks (references projects)
    const deleteTasksStmt = db.prepare(`
      DELETE FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = ?
      )
    `)
    deleteTasksStmt.run(userIdStr)

    // 6. Finally delete all projects for the user
    const deleteProjectsStmt = db.prepare(
      'DELETE FROM projects WHERE user_id = ?'
    )
    deleteProjectsStmt.run(userIdStr)

    // Commit transaction
    db.exec('COMMIT')

    console.log(
      `[Database] Successfully deleted all projects and related data for user: ${userIdStr}`
    )
  } catch (error) {
    // Rollback on error
    try {
      db.exec('ROLLBACK')
    } catch (rollbackError) {
      console.error('[Database] Rollback error:', rollbackError)
    }
    console.error(
      `[Database] Error deleting all projects for user ${userIdStr}:`,
      error
    )
    throw error
  }
}

// Task operations
export const saveTask = task => {
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
    // Handle both assignees array and legacy assignee field
    (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0)
      ? task.assignees.join(', ')
      : (task.assignee || null),
    JSON.stringify(task.subtasks || []),
    JSON.stringify(task.comments || []),
    JSON.stringify(task.linkedTasks || []),
    JSON.stringify(task.aiCreatedLinks || []),
    JSON.stringify(task.aiDiscoveredLinks || []),
    JSON.stringify(task.rejectedAiLinks || [])
  )
}

export const deleteTask = taskId => {
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

export const getMeeting = meetingId => {
  const stmt = db.prepare('SELECT * FROM meetings WHERE id = ?')
  return stmt.get(meetingId)
}

export const getAllMeetings = userId => {
  // Ensure userId is always a string to prevent type mismatches
  const userIdStr = String(userId)
  const stmt = db.prepare(
    'SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC'
  )
  return stmt.all(userIdStr)
}

export const deleteMeeting = meetingId => {
  const stmt = db.prepare('DELETE FROM meetings WHERE id = ?')
  stmt.run(meetingId)
}

// User operations for local authentication
export const getUserById = userId => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1')
  return stmt.get(userId)
}

export const getUserByEmail = email => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1')
  return stmt.get(email)
}

export const getUserByOIDC = (issuer, sub) => {
  const stmt = db.prepare(
    'SELECT * FROM users WHERE oidc_issuer = ? AND oidc_sub = ? AND active = 1'
  )
  return stmt.get(issuer, sub)
}

export const createUser = userData => {
  const multiTenancyEnabled = process.env.MULTITENANCY_ENABLED === 'true'

  let stmt, result

  if (multiTenancyEnabled) {
    stmt = db.prepare(`
      INSERT INTO users (
        email, email_verified, name, picture, role, auth_provider,
        password_hash, oidc_issuer, oidc_sub, tenant_id, last_login
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    result = stmt.run(
      userData.email || null,
      userData.email_verified ? 1 : 0,
      userData.name || null,
      userData.picture || null,
      userData.role || 'member',
      userData.auth_provider || 'local',
      userData.password_hash || null,
      userData.oidc_issuer || null,
      userData.oidc_sub || null,
      userData.tenant_id || null
    )
  } else {
    stmt = db.prepare(`
      INSERT INTO users (
        email, email_verified, name, picture, role, auth_provider,
        password_hash, oidc_issuer, oidc_sub, last_login
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    result = stmt.run(
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
  }

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

  if (fields.length === 0) {
    return getUserById(userId)
  }

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(userId)

  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
  stmt.run(...values)

  return getUserById(userId)
}

export const updateUserLogin = userId => {
  const stmt = db.prepare(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  )
  stmt.run(userId)
}

export const getAllUsers = () => {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC')
  return stmt.all()
}

export const deleteUser = userId => {
  // Check if this is the last admin
  const adminCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1"
    )
    .get()
  const user = getUserById(userId)

  if (user && user.role === 'admin' && adminCount.count === 1) {
    throw new Error('Cannot delete the last admin user')
  }

  try {
    // Start transaction for complete data removal
    db.transaction(() => {
      console.log(`[Database] Deleting all data for user ${userId}`)

      // Get user's project IDs to delete associated tasks and meetings
      const userProjects = db
        .prepare('SELECT id FROM projects WHERE user_id = ?')
        .all(userId)
      const projectIds = userProjects.map(p => p.id)

      if (projectIds.length > 0) {
        // Delete tasks for all user's projects
        const deleteTasksStmt = db.prepare(
          `DELETE FROM tasks WHERE project_id IN (${projectIds.map(() => '?').join(',')})`
        )
        deleteTasksStmt.run(...projectIds)
      }

      // Delete user's meetings
      const deleteMeetingsStmt = db.prepare(
        'DELETE FROM meetings WHERE user_id = ?'
      )
      deleteMeetingsStmt.run(userId)

      // Delete user's projects
      const deleteProjectsStmt = db.prepare(
        'DELETE FROM projects WHERE user_id = ?'
      )
      deleteProjectsStmt.run(userId)

      // Delete user's settings
      const deleteSettingsStmt = db.prepare(
        'DELETE FROM settings WHERE user_id = ?'
      )
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
  const stmt = db.prepare(
    'SELECT COUNT(*) as count FROM users WHERE active = 1'
  )
  const result = stmt.get()
  return result.count > 0
}

// Analytics insights caching methods
export const saveAnalyticsInsights = (
  userId,
  projectId,
  insights,
  taskCount,
  timestamp
) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analytics_insights
    (user_id, project_id, insights, task_count, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `)
  return stmt.run(userId, projectId, insights, taskCount, timestamp)
}

export const getAnalyticsInsights = (userId, projectId) => {
  const stmt = db.prepare(`
    SELECT insights, task_count, timestamp
    FROM analytics_insights
    WHERE user_id = ? AND project_id IS ?
  `)
  return stmt.get(userId, projectId)
}

export const clearAnalyticsInsights = (userId, projectId) => {
  const stmt = db.prepare(`
    DELETE FROM analytics_insights
    WHERE user_id = ? AND project_id IS ?
  `)
  return stmt.run(userId, projectId)
}

export const clearAllAnalyticsInsights = userId => {
  const stmt = db.prepare(`
    DELETE FROM analytics_insights
    WHERE user_id = ?
  `)
  return stmt.run(userId)
}

// Task change tracking methods
export const recordTaskChange = (
  taskId,
  userId,
  changeType,
  fieldName = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  projectId = null
) => {
  // CRITICAL FIX: Prevent NULL/empty task_id from being inserted
  if (!taskId || taskId === '' || taskId === null || taskId === undefined) {
    console.error(
      '[recordTaskChange] BLOCKED: Attempted to record change with NULL/empty task_id:',
      JSON.stringify(taskId)
    )
    console.error('[recordTaskChange] Change details:', {
      userId,
      changeType,
      fieldName,
      oldValue,
      newValue
    })
    return null
  }

  console.log('[recordTaskChange] Input params:', {
    taskId,
    userId,
    changeType,
    fieldName,
    oldValue:
      typeof oldValue === 'string'
        ? oldValue.substring(0, 50) + '...'
        : oldValue,
    newValue:
      typeof newValue === 'string'
        ? newValue.substring(0, 50) + '...'
        : newValue,
    projectId
  })

  // If projectId not provided, try to get it from the task
  let finalProjectId = projectId
  if (!finalProjectId && taskId) {
    const task = db
      .prepare('SELECT project_id FROM tasks WHERE id = ?')
      .get(taskId)
    console.log('[recordTaskChange] Task lookup result:', task)
    finalProjectId = task?.project_id || null
  }

  console.log('[recordTaskChange] Final values:', { taskId, finalProjectId })

  const stmt = db.prepare(`
    INSERT INTO task_changes
    (task_id, project_id, user_id, change_type, field_name, old_value, new_value, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const oldValueStr = oldValue
    ? typeof oldValue === 'object'
      ? JSON.stringify(oldValue)
      : oldValue.toString()
    : null
  const newValueStr = newValue
    ? typeof newValue === 'object'
      ? JSON.stringify(newValue)
      : newValue.toString()
    : null
  const metadataStr = metadata ? JSON.stringify(metadata) : null

  return stmt.run(
    taskId,
    finalProjectId,
    userId,
    changeType,
    fieldName,
    oldValueStr,
    newValueStr,
    metadataStr
  )
}

export const getTaskChanges = (taskId, limit = 50) => {
  const stmt = db.prepare(`
    SELECT tc.*, u.name as user_name, u.email as user_email
    FROM task_changes tc
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at DESC
    LIMIT ?
  `)

  const changes = stmt.all(taskId, limit)

  // Parse JSON fields
  return changes.map(change => ({
    ...change,
    old_value: change.old_value
      ? change.old_value.startsWith('{') || change.old_value.startsWith('[')
        ? JSON.parse(change.old_value)
        : change.old_value
      : null,
    new_value: change.new_value
      ? change.new_value.startsWith('{') || change.new_value.startsWith('[')
        ? JSON.parse(change.new_value)
        : change.new_value
      : null,
    metadata: change.metadata ? JSON.parse(change.metadata) : null
  }))
}

export const getProjectTaskChanges = (projectId, limit = 100) => {
  const stmt = db.prepare(`
    SELECT tc.*,
           CASE
             WHEN tc.change_type = 'ai_comment_added' THEN 'AI Coordinator'
             ELSE u.name
           END as user_name,
           u.email as user_email,
           t.title as task_title
    FROM task_changes tc
    LEFT JOIN users u ON tc.user_id = u.id
    LEFT JOIN tasks t ON tc.task_id = t.id
    WHERE tc.project_id = ?
    ORDER BY tc.created_at DESC
    LIMIT ?
  `)

  const changes = stmt.all(projectId, limit)

  return changes.map(change => {
    const metadata = change.metadata ? JSON.parse(change.metadata) : null
    return {
      ...change,
      // Use task title from metadata if task was deleted (task_title is NULL)
      task_title: change.task_title || metadata?.title || 'Unknown Task',
      old_value: change.old_value
        ? change.old_value.startsWith('{') || change.old_value.startsWith('[')
          ? JSON.parse(change.old_value)
          : change.old_value
        : null,
      new_value: change.new_value
        ? change.new_value.startsWith('{') || change.new_value.startsWith('[')
          ? JSON.parse(change.new_value)
          : change.new_value
        : null,
      metadata
    }
  })
}

// BULLETPROOF AI COMMENT SYSTEM - Single function that NEVER fails
export const createAIComment = (taskId, userId, content, metadata = null) => {
  console.log('[BULLETPROOF] Creating AI comment for task:', taskId)

  // STEP 1: Validate inputs - fail fast if invalid
  if (!taskId || !userId || !content) {
    console.error('[BULLETPROOF] Invalid inputs:', { taskId, userId, content })
    throw new Error('Invalid inputs for AI comment creation')
  }

  // STEP 2: Verify task exists and get project_id + task title
  const task = db
    .prepare('SELECT project_id, title FROM tasks WHERE id = ?')
    .get(taskId)
  if (!task) {
    console.error('[BULLETPROOF] Task not found:', taskId)
    throw new Error(`Task ${taskId} not found`)
  }

  const projectId = task.project_id
  const taskTitle = task.title
  console.log(
    '[BULLETPROOF] Found task in project:',
    projectId,
    '- Task:',
    taskTitle
  )

  // STEP 3: Create comment and activity in single atomic transaction
  const transaction = db.transaction(() => {
    const commentId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Insert comment
    const commentStmt = db.prepare(`
      INSERT INTO task_comments
      (id, task_id, user_id, author_name, content, comment_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const commentResult = commentStmt.run(
      commentId,
      taskId,
      userId,
      'AI Coordinator',
      content,
      'ai_update',
      metadata ? JSON.stringify(metadata) : null
    )

    if (commentResult.changes !== 1) {
      throw new Error('Failed to insert comment')
    }

    // Insert activity with GUARANTEED task_id and project_id
    const activityStmt = db.prepare(`
      INSERT INTO task_changes
      (task_id, project_id, user_id, change_type, field_name, old_value, new_value, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const activityResult = activityStmt.run(
      taskId, // GUARANTEED not null
      projectId, // GUARANTEED not null
      userId,
      'ai_comment_added',
      null,
      null,
      content,
      JSON.stringify({
        commentId,
        commentType: 'ai_update',
        taskTitle: taskTitle,
        taskId: taskId,
        projectId: projectId
      })
    )

    if (activityResult.changes !== 1) {
      throw new Error('Failed to insert activity')
    }

    console.log('[BULLETPROOF] ✓ Comment and activity created:', commentId)
    return { commentId, taskId, projectId }
  })

  return transaction()
}

// Legacy function for backward compatibility
export const addTaskComment = (
  commentId,
  taskId,
  userId,
  authorName,
  content,
  commentType = 'user',
  metadata = null
) => {
  const stmt = db.prepare(`
    INSERT INTO task_comments
    (id, task_id, user_id, author_name, content, comment_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const metadataStr = metadata ? JSON.stringify(metadata) : null
  return stmt.run(
    commentId,
    taskId,
    userId,
    authorName,
    content,
    commentType,
    metadataStr
  )
}

export const getTaskComments = (taskId, limit = 50) => {
  const stmt = db.prepare(`
    SELECT tc.*, u.name as user_name, u.email as user_email
    FROM task_comments tc
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at ASC
    LIMIT ?
  `)

  const comments = stmt.all(taskId, limit)

  return comments.map(comment => ({
    ...comment,
    metadata: comment.metadata ? JSON.parse(comment.metadata) : null
  }))
}

export const updateTaskComment = (commentId, content) => {
  const stmt = db.prepare(`
    UPDATE task_comments
    SET content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  return stmt.run(content, commentId)
}

export const getTaskComment = commentId => {
  const stmt = db.prepare(`
    SELECT tc.*, u.name as user_name, u.email as user_email
    FROM task_comments tc
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.id = ?
  `)
  const comment = stmt.get(commentId)
  if (comment) {
    return {
      ...comment,
      metadata: comment.metadata ? JSON.parse(comment.metadata) : null
    }
  }
  return null
}

export const deleteTaskComment = (commentId, userId) => {
  const stmt = db.prepare(`
    DELETE FROM task_comments
    WHERE id = ? AND user_id = ?
  `)
  return stmt.run(commentId, userId)
}

// Export all data
export const exportAll = userId => {
  return {
    settings: getSettings(userId),
    projects: getAllProjects(userId).map(p => getProject(p.id))
  }
}

// Task merge undo functionality
export const storeMergeUndoData = (userId, projectId, mergeMetadata) => {
  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_merge_undo (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      merge_id TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+24 hours'))
    )
  `)

  const stmt = db.prepare(`
    INSERT INTO task_merge_undo (id, user_id, project_id, merge_id, metadata)
    VALUES (?, ?, ?, ?, ?)
  `)

  const undoId = `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  stmt.run(
    undoId,
    String(userId),
    projectId,
    mergeMetadata.id,
    JSON.stringify(mergeMetadata)
  )

  // Clean up expired undo data
  cleanupExpiredUndoData()

  return undoId
}

export const getMergeUndoData = (userId, projectId, mergeId) => {
  const stmt = db.prepare(`
    SELECT * FROM task_merge_undo
    WHERE user_id = ? AND project_id = ? AND merge_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `)

  return stmt.get(String(userId), projectId, mergeId)
}

export const deleteMergeUndoData = (userId, projectId, mergeId) => {
  const stmt = db.prepare(`
    DELETE FROM task_merge_undo
    WHERE user_id = ? AND project_id = ? AND merge_id = ?
  `)

  return stmt.run(String(userId), projectId, mergeId)
}

export const getRecentMerges = (userId, projectId) => {
  const stmt = db.prepare(`
    SELECT id, merge_id, metadata, created_at
    FROM task_merge_undo
    WHERE user_id = ? AND project_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `)

  const rows = stmt.all(userId, projectId)
  return rows.map(row => {
    const metadata = JSON.parse(row.metadata)
    return {
      id: row.merge_id,
      title: metadata.mergedTask.title,
      originalTasks: metadata.originalTasks,
      timestamp: row.created_at
    }
  })
}

export const cleanupExpiredUndoData = () => {
  const stmt = db.prepare(`
    DELETE FROM task_merge_undo
    WHERE expires_at <= datetime('now')
  `)

  return stmt.run()
}

// ===== INVITE TOKEN FUNCTIONS =====

/**
 * Create a new invite token
 */
export const createInviteToken = (tokenData) => {
  const stmt = db.prepare(`
    INSERT INTO invite_tokens (id, token, tenant_id, inviter_id, invitee_email, role, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    tokenData.id,
    tokenData.token,
    tokenData.tenant_id,
    tokenData.inviter_id,
    tokenData.invitee_email,
    tokenData.role,
    tokenData.expires_at
  )

  return result.changes > 0
}

/**
 * Get invite token by token string
 */
export const getInviteTokenByToken = (token) => {
  const stmt = db.prepare(`
    SELECT it.*, t.name as tenant_name, t.subdomain, u.name as inviter_name, u.email as inviter_email
    FROM invite_tokens it
    JOIN tenants t ON it.tenant_id = t.id
    JOIN users u ON it.inviter_id = u.id
    WHERE it.token = ? AND it.used = 0 AND it.expires_at > datetime('now')
  `)

  return stmt.get(token)
}

/**
 * Mark invite token as used
 */
export const markInviteTokenUsed = (token, userId) => {
  const stmt = db.prepare(`
    UPDATE invite_tokens
    SET used = 1, used_by = ?, used_at = datetime('now')
    WHERE token = ?
  `)

  const result = stmt.run(userId, token)
  return result.changes > 0
}

/**
 * Get invite tokens for a tenant (for admin management)
 */
export const getInviteTokensForTenant = (tenantId) => {
  const stmt = db.prepare(`
    SELECT it.*, u.name as inviter_name, u.email as inviter_email,
           used_user.name as used_by_name, used_user.email as used_by_email
    FROM invite_tokens it
    JOIN users u ON it.inviter_id = u.id
    LEFT JOIN users used_user ON it.used_by = used_user.id
    WHERE it.tenant_id = ?
    ORDER BY it.created_at DESC
  `)

  return stmt.all(tenantId)
}

/**
 * Delete expired invite tokens (cleanup job)
 */
export const cleanupExpiredInviteTokens = () => {
  const stmt = db.prepare(`
    DELETE FROM invite_tokens
    WHERE expires_at <= datetime('now') AND used = 0
  `)

  return stmt.run()
}

export default db
