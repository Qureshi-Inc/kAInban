import * as uuid from 'uuid'
import dbInstance from './database.js'
const { v4: uuidv4 } = uuid

const db = dbInstance

const multiTenancyEnabled = process.env.MULTITENANCY_ENABLED === 'true'

class TenantService {

  // Check if multi-tenancy is enabled
  isEnabled() {
    return multiTenancyEnabled
  }

  // Create a new tenant
  async createTenant({ name, subdomain, plan = 'starter', maxUsers = 5 }) {
    if (!multiTenancyEnabled) {
      throw new Error('Multi-tenancy is not enabled')
    }

    // Validate subdomain format (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      throw new Error('Subdomain can only contain lowercase letters, numbers, and hyphens')
    }

    // Security: Prevent reserved subdomain registration
    const reservedSubdomains = [
      'www', 'api', 'admin', 'root', 'mail', 'ftp', 'ssh',
      'mysql', 'postgres', 'redis', 'dev', 'test', 'staging',
      'support', 'help', 'docs', 'blog', 'status', 'cdn'
    ]

    if (reservedSubdomains.includes(subdomain)) {
      throw new Error('This subdomain is reserved and cannot be used')
    }

    const tenantId = uuidv4()
    const settings = {
      created_by: 'system',
      initial_setup: false
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO tenants (id, name, subdomain, plan, max_users, settings, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)

      stmt.run(tenantId, name, subdomain, plan, maxUsers, JSON.stringify(settings))

      console.log('[TenantService] Created tenant:', { tenantId, name, subdomain, plan })

      console.log('[TenantService] Tenant created successfully - accessible at /tenant/' + subdomain)

      return {
        id: tenantId,
        name,
        subdomain,
        plan,
        maxUsers,
        settings
      }
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed: tenants.subdomain')) {
        throw new Error('Subdomain already taken')
      }
      throw error
    }
  }

  // Get tenant by subdomain
  async getTenantBySubdomain(subdomain) {
    if (!multiTenancyEnabled) {return null}

    const stmt = db.prepare('SELECT * FROM tenants WHERE subdomain = ? AND active = 1')
    const tenant = stmt.get(subdomain)

    if (tenant && tenant.settings) {
      tenant.settings = JSON.parse(tenant.settings)
    }

    return tenant
  }

  // Get tenant by ID
  async getTenantById(tenantId) {
    if (!multiTenancyEnabled) {return null}

    const stmt = db.prepare('SELECT * FROM tenants WHERE id = ? AND active = 1')
    const tenant = stmt.get(tenantId)

    if (tenant && tenant.settings) {
      tenant.settings = JSON.parse(tenant.settings)
    }

    return tenant
  }

  // Resolve the tenant for a request. Always derived from the authenticated
  // user's tenant_id, never trusted from the URL.
  //
  // If the caller passes ?tenant=<subdomain>, that's accepted ONLY when the
  // requested subdomain matches the user's own tenant. Without this check,
  // any authenticated user could pass ?tenant=victim and the middleware would
  // attach the victim's tenant to req.tenant - letting them mint invites,
  // list invites, or otherwise act inside another tenant.
  async extractTenantFromRequest(req) {
    if (!multiTenancyEnabled) {return null}

    if (!req.session || !req.session.user || !req.session.user.id) {
      return null
    }

    // Look up the user's own tenant first - this is the source of truth.
    const userRow = db
      .prepare('SELECT tenant_id FROM users WHERE id = ? AND active = 1')
      .get(req.session.user.id)
    if (!userRow || !userRow.tenant_id) {
      return null
    }
    const ownTenant = await this.getTenantById(userRow.tenant_id)
    if (!ownTenant) {
      return null
    }

    // If a ?tenant= override was passed, verify it resolves to the user's
    // own tenant - otherwise reject the override silently (don't leak that
    // the queried tenant exists).
    const tenantQuery = req.query?.tenant
    if (tenantQuery && tenantQuery !== ownTenant.subdomain) {
      console.warn(
        '[TenantService] Rejected tenant query override',
        { user: req.session.user.id, requested: tenantQuery, owned: ownTenant.subdomain }
      )
      // Fall through to user's own tenant rather than 403'ing here - a 403
      // would expose tenant existence. Higher-level routes can add stricter
      // checks if needed.
    }

    return ownTenant
  }

  // Check if user can be added to tenant (within limits)
  async canAddUserToTenant(tenantId) {
    if (!multiTenancyEnabled) {return true}

    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {return false}

    const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND active = 1')
    const result = userCountStmt.get(tenantId)

    return result.count < tenant.max_users
  }

  // Associate user with tenant
  async addUserToTenant(userId, tenantId) {
    if (!multiTenancyEnabled) {return}

    const stmt = db.prepare('UPDATE users SET tenant_id = ? WHERE id = ?')
    stmt.run(tenantId, userId)

    console.log('[TenantService] Associated user', userId, 'with tenant', tenantId)
  }

  // Get tenant usage stats
  async getTenantStats(tenantId) {
    if (!multiTenancyEnabled) {return null}

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND active = 1').get(tenantId)

    // Get tenant users to count their projects and tasks
    const tenantUserIds = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND active = 1').all(tenantId)
    const userIdList = tenantUserIds.map(u => u.id)

    let projectCount = { count: 0 }
    let taskCount = { count: 0 }

    if (userIdList.length > 0) {
      const placeholders = userIdList.map(() => '?').join(',')
      projectCount = db.prepare(`SELECT COUNT(*) as count FROM projects WHERE user_id IN (${placeholders})`).get(...userIdList)
      taskCount = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (${placeholders}))`).get(...userIdList)
    }

    return {
      users: userCount.count,
      projects: projectCount.count,
      tasks: taskCount.count
    }
  }
}

export default new TenantService()