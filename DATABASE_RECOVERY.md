# Database Recovery Guide

## 🚨 Emergency User Creation

If your database loses all users and you can't log in:

### 1. **Check Database Status**
```bash
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
const db = new Database('./storage/app.db');
console.log('Users:', db.prepare('SELECT COUNT(*) as count FROM users').get());
console.log('Projects:', db.prepare('SELECT COUNT(*) as count FROM projects').get());
console.log('Tenants:', db.prepare('SELECT COUNT(*) as count FROM tenants').get());
"
```

### 2. **Create Admin User with Tenant**
```bash
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
import { hash } from '@node-rs/argon2';

const db = new Database('./storage/app.db');

// Create tenant first
const tenantId = 'tenant_admin_' + Date.now();
db.prepare(\`
  INSERT INTO tenants (id, name, subdomain, plan, active)
  VALUES (?, ?, ?, 'pro', 1)
\`).run(tenantId, 'Admin Organization', 'admin');

// Hash password
const passwordHash = await hash('TestPass123!', {
  memoryCost: 19456, timeCost: 2, parallelism: 1
});

// Create admin user
db.prepare(\`
  INSERT INTO users (email, name, password_hash, role, auth_provider, active, email_verified, tenant_id)
  VALUES (?, ?, ?, 'admin', 'local', 1, 1, ?)
\`).run('admin@example.com', 'Admin User', passwordHash, tenantId);

console.log('✅ Admin user created with tenant');
console.log('📧 Email: admin@example.com');
console.log('🔑 Password: TestPass123!');
console.log('🏢 Tenant: admin (/?tenant=admin)');
"
```

### 3. **Verify Creation**
```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "TestPass123!"
  }'
```

Should return:
```json
{
  "success": true,
  "user": {...},
  "redirectUrl": "/?tenant=admin"
}
```

## 🔄 Database Backup/Restore

### **Manual Backup**
```bash
# Create timestamped backup
cp storage/app.db "storage/app.db.backup.$(date +%Y%m%d_%H%M%S)"

# Compress old backups
tar -czf "storage/backups_$(date +%Y%m).tar.gz" storage/app.db.backup.* && rm storage/app.db.backup.*
```

### **Automated Backup Script**
```bash
#!/bin/bash
# Add to cron: 0 */4 * * * /path/to/backup-script.sh

BACKUP_DIR="/home/qcloud/notes/storage/backups"
DB_PATH="/home/qcloud/notes/storage/app.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/app.db.$TIMESTAMP"

# Keep only last 24 backups (4 days if run every 4 hours)
ls -t "$BACKUP_DIR"/app.db.* | tail -n +25 | xargs rm -f

echo "Database backed up: app.db.$TIMESTAMP"
```

### **Restore from Backup**
```bash
# Stop the application
docker compose stop api

# List available backups
ls -la storage/backups/ | grep app.db

# Restore from backup (replace TIMESTAMP with actual backup)
cp storage/backups/app.db.TIMESTAMP storage/app.db

# Restart application
docker compose start api
```

## 🔍 Database Health Checks

### **Check Table Integrity**
```bash
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
const db = new Database('./storage/app.db');

console.log('=== Database Health Check ===');
try {
  // Check each table exists and has reasonable data
  const tables = ['users', 'projects', 'tasks', 'tenants', 'tenant_users'];

  tables.forEach(table => {
    try {
      const count = db.prepare(\`SELECT COUNT(*) as count FROM \${table}\`).get();
      console.log(\`✅ \${table}: \${count.count} records\`);
    } catch(e) {
      console.log(\`❌ \${table}: ERROR - \${e.message}\`);
    }
  });

  // Check for admin users
  const admins = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
  console.log(\`👑 Admin users: \${admins.count}\`);

  // Check tenant associations
  const usersWithTenants = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id IS NOT NULL').get();
  console.log(\`🏢 Users with tenants: \${usersWithTenants.count}\`);

} catch(e) {
  console.log('❌ Database error:', e.message);
}
"
```

### **Check User Authentication**
```bash
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
const db = new Database('./storage/app.db');

console.log('=== User Authentication Check ===');
const users = db.prepare(\`
  SELECT email, name, role, auth_provider, active, tenant_id
  FROM users
  WHERE active = 1
\`).all();

users.forEach(user => {
  console.log(\`👤 \${user.email} (\${user.role}) - Provider: \${user.auth_provider} - Tenant: \${user.tenant_id || 'None'}\`);
});

if (users.length === 0) {
  console.log('⚠️  No active users found - you need to create an admin user');
}
"
```

## 🚑 Emergency Recovery Procedures

### **If App Shows Signup Page (No Users)**
1. Check database: Run health check above
2. If no users: Create admin user (step 2 above)
3. If users exist but app doesn't recognize: Check `hasUsers()` function in database.js

### **If Login Fails with Rate Limiting**
```bash
# Increase rate limits temporarily
docker exec notes-api-1 sed -i 's/max: 5/max: 100/' server.js
docker compose restart api
```

### **If Projects/Data Missing**
1. Check if user has correct tenant association
2. Verify tenant exists in tenants table
3. Check if projects are scoped to wrong tenant

### **Complete Nuclear Option**
```bash
# 🚨 WARNING: This deletes everything!

# Stop app
docker compose down

# Backup current state (just in case)
cp storage/app.db storage/app.db.broken.$(date +%s)

# Delete database
rm storage/app.db

# Restart (will create fresh database)
docker compose up -d

# Create admin user with tenant (run step 2 above)
```

## 📱 Quick Test Commands

After any recovery:
```bash
# 1. Check auth status
curl -s localhost:3001/api/auth/status

# 2. Test login
curl -X POST localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"TestPass123!"}'

# 3. Check if authenticated user can access data
curl -s localhost:3001/api/auth/me -b cookies.txt

# 4. Test tenant parameter
curl -s "localhost:3001/api/projects?tenant=admin" -b cookies.txt
```

All commands should return successful responses with proper data.