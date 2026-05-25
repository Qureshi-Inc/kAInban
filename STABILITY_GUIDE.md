# KAInban Stability Guide

## 🚨 Common Issues and Solutions

### 1. **Rate Limiting Blocks Login**
**Symptoms:** "Too many authentication attempts, please try again later"
**Cause:** Auth rate limiter set to 5 attempts per 15 minutes
**Solution:**
```bash
# Increase rate limit in server/server.js
const authLimiter = expressRateLimit({
  max: 100, // Increase from 5 to 100
})
```

### 2. **Database Data Loss**
**Symptoms:** App shows signup page, no projects/tasks visible
**Cause:** Database corruption or accidental deletion
**Solution:**
```bash
# Check database
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
const db = new Database('./storage/app.db');
console.log('Users:', db.prepare('SELECT COUNT(*) FROM users').get());
"

# Restore from backup (if available)
cp storage/app.db.backup storage/app.db

# Or create admin user manually (see DATABASE_RECOVERY.md)
```

### 3. **Docker Build Cache Issues**
**Symptoms:** Code changes not reflected in running app
**Solution:**
```bash
# Force rebuild without cache
docker compose build --no-cache api
docker compose restart api
```

### 4. **reCAPTCHA Blocking Signups**
**Symptoms:** Registration fails with reCAPTCHA errors
**Solution:**
```bash
# Disable reCAPTCHA in development
# Comment out in .env and docker-compose.yml:
# RECAPTCHA_SITE_KEY=
# RECAPTCHA_SECRET_KEY=
```

### 5. **Environment Variable Conflicts**
**Symptoms:** Settings don't take effect despite changes
**Cause:** Multiple .env files with conflicting values
**Solution:**
```bash
# Check all environment files
find . -name ".env*" -type f
# Ensure consistent values across:
# - .env
# - server/.env
# - docker-compose.yml environment section
```

## 🔧 Prevention Strategies

### 1. **Database Backups**
```bash
# Add to crontab for automatic backups
0 */6 * * * cp /home/qcloud/notes/storage/app.db /home/qcloud/notes/storage/app.db.backup.$(date +%Y%m%d_%H%M)
```

### 2. **Development vs Production Settings**
- Use `.env.development` for dev-friendly rate limits
- Keep production security settings in `.env.production`
- Document which environment you're running

### 3. **Docker Best Practices**
```bash
# Always rebuild when making server changes
docker compose build api && docker compose restart api

# Check what's actually running
docker exec notes-api-1 grep -A 5 "authLimiter" server.js
```

### 4. **Configuration Management**
- Keep all environment variables documented
- Use consistent naming across files
- Test changes in development first

## 🚀 Quick Recovery Commands

### Full System Reset
```bash
# Stop everything
docker compose down

# Rebuild from scratch
docker compose build --no-cache

# Start fresh
docker compose up -d

# Check health
curl http://localhost:3001/api/auth/status
```

### Emergency User Creation
```bash
# If database is empty, create admin user
docker exec notes-api-1 node -e "
import Database from 'better-sqlite3';
import { hash } from '@node-rs/argon2';

const db = new Database('./storage/app.db');
const passwordHash = await hash('TestPass123!', {
  memoryCost: 19456, timeCost: 2, parallelism: 1
});

db.prepare(\`
  INSERT INTO users (email, name, password_hash, role, auth_provider, active, email_verified)
  VALUES (?, ?, ?, 'admin', 'local', 1, 1)
\`).run('admin@example.com', 'Admin User', passwordHash);

console.log('Emergency admin user created');
"
```

## 📋 Health Check Checklist

Before making changes:
- [ ] Database has users: `curl -s localhost:3001/api/auth/status | grep hasUsers`
- [ ] Rate limits are reasonable for your use case
- [ ] Environment variables are consistent
- [ ] Docker containers are running latest code
- [ ] Backup database exists and is recent

After making changes:
- [ ] Login works: `curl -X POST localhost:3001/api/auth/login -d '{"email":"admin@example.com","password":"TestPass123!"}'`
- [ ] Projects can be created and retrieved
- [ ] Tenant parameters work correctly
- [ ] No rate limiting errors in logs

## 🆘 Emergency Contacts

If all else fails:
1. Check Docker logs: `docker compose logs api --tail=50`
2. Verify database integrity: See DATABASE_RECOVERY.md
3. Review recent git changes: `git log --oneline -10`
4. Roll back to working state if needed