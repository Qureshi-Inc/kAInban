# Docker Deployment Guide

This guide explains how to deploy kAInban using Docker in a fully containerized environment. No
local Node.js or npm installation is required.

## Prerequisites

- Docker Engine (20.10+)
- Docker Compose (2.0+)
- Git (to clone the repository)

## Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Qureshi-Inc/kAInban.git
   cd kAInban
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # Database
   DATABASE_URL=sqlite:./storage/kainban.db

   # OpenAI API (required for transcription and task extraction)
   OPENAI_API_KEY=your_openai_api_key
   AZURE_OPENAI_ENDPOINT=your_azure_endpoint
   AZURE_OPENAI_API_KEY=your_azure_key

   # PocketID OAuth (optional but recommended)
   ENABLE_OIDC=true
   POCKET_ID_ISSUER=https://login.qureshi.io
   POCKET_ID_CLIENT_ID=your_client_id
   POCKET_ID_CLIENT_SECRET=your_client_secret
   POCKET_ID_CALLBACK_URL=https://your-domain.com/api/auth/oidc/callback

   # CORS Configuration
   CORS_ORIGIN=https://your-domain.com
   ```

3. **Deploy with Docker Compose:**

   ```bash
   docker compose up -d
   ```

4. **Access the application:**
   - Frontend: http://localhost:8064
   - API: http://localhost:3001
   - Health check: http://localhost:8064/health

## Architecture

The Docker setup consists of two services:

### Frontend Service (`kainban-frontend`)

- **Image**: nginx:alpine
- **Port**: 8064
- **Purpose**: Serves the React application built with Vite
- **Health Check**: Endpoint available at `/health`

### API Service (`kainban-api`)

- **Image**: node:20-alpine
- **Port**: 3001
- **Purpose**: Express.js API server with SQLite database
- **Features**:
  - Audio transcription with OpenAI Whisper
  - AI task extraction with GPT-4
  - PocketID OAuth authentication
  - File upload handling

## Docker Configuration Details

### Frontend Dockerfile

- Multi-stage build process
- Installs all dependencies (including dev dependencies for build)
- Builds the React application with Vite
- Serves static files through nginx
- Custom nginx configuration for SPA routing

### API Dockerfile

- Alpine Linux base with compatibility packages for native modules
- Installs build tools for native module compilation
- Rebuilds better-sqlite3 from source for Alpine compatibility
- Creates storage directory for SQLite database and uploads

### .dockerignore

Excludes development files and lock files to prevent conflicts:

- `node_modules/` directories
- `package-lock.json` files (Docker generates its own)
- Development configuration files
- Temporary and cache files

## Storage and Data Persistence

### Database

- SQLite database stored in `./storage/kainban.db`
- Automatically created on first startup
- Persisted through Docker volume mapping

### File Uploads

- Audio files and attachments stored in `./storage/uploads/`
- Configurable upload size limits
- Automatic cleanup of temporary files

## Environment Variables Reference

### Required Variables

| Variable         | Description                      | Example                       |
| ---------------- | -------------------------------- | ----------------------------- |
| `OPENAI_API_KEY` | OpenAI API key for transcription | `sk-...`                      |
| `DATABASE_URL`   | SQLite database path             | `sqlite:./storage/kainban.db` |

### Optional OAuth Variables

| Variable                  | Description                    | Default |
| ------------------------- | ------------------------------ | ------- |
| `ENABLE_OIDC`             | Enable PocketID authentication | `false` |
| `POCKET_ID_ISSUER`        | PocketID issuer URL            | -       |
| `POCKET_ID_CLIENT_ID`     | OAuth client ID                | -       |
| `POCKET_ID_CLIENT_SECRET` | OAuth client secret            | -       |
| `POCKET_ID_CALLBACK_URL`  | OAuth callback URL             | -       |

### Optional Configuration

| Variable        | Description           | Default      |
| --------------- | --------------------- | ------------ |
| `PORT`          | API server port       | `3001`       |
| `CORS_ORIGIN`   | Allowed CORS origins  | `*`          |
| `MAX_FILE_SIZE` | Max upload size in MB | `50`         |
| `NODE_ENV`      | Environment mode      | `production` |

## Troubleshooting

### Container Startup Issues

**Problem**: API container keeps restarting

```bash
docker compose logs kainban-api
```

**Common Solutions**:

1. Check environment variables in `.env`
2. Ensure storage directory permissions
3. Verify OpenAI API key validity

### Database Connection Issues

**Problem**: SQLite database errors

```bash
# Check storage directory
docker compose exec kainban-api ls -la ./storage/

# Reset database (WARNING: deletes all data)
docker compose down
sudo rm -rf ./storage/kainban.db*
docker compose up -d
```

### Build Issues

**Problem**: Docker build fails

```bash
# Clean build without cache
docker compose build --no-cache

# Check for build errors
docker compose logs --build
```

### Native Module Issues

The Docker setup handles Alpine Linux compatibility for better-sqlite3 automatically by:

- Installing build dependencies (gcc, g++, make, python3)
- Adding glibc compatibility packages
- Rebuilding native modules from source

If you encounter native module errors, try:

```bash
docker compose build --no-cache kainban-api
```

## Production Deployment

### Reverse Proxy Configuration

For production deployment behind nginx or another reverse proxy:

```nginx
upstream kainban_frontend {
    server localhost:8064;
}

upstream kainban_api {
    server localhost:3001;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://kainban_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://kainban_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL/HTTPS Setup

Update your `.env` file for HTTPS:

```env
CORS_ORIGIN=https://your-domain.com
POCKET_ID_CALLBACK_URL=https://your-domain.com/api/auth/oidc/callback
```

### Scaling Considerations

For high-traffic deployments:

1. Use external database (PostgreSQL recommended)
2. Implement Redis for session storage
3. Configure load balancing for multiple API instances
4. Use object storage (S3) for file uploads

## Backup and Restore

### Backup

```bash
# Backup SQLite database
docker compose exec kainban-api cp ./storage/kainban.db ./storage/backup-$(date +%Y%m%d).db

# Copy backup to host
docker compose cp kainban-api:/app/storage/backup-$(date +%Y%m%d).db ./backups/
```

### Restore

```bash
# Stop services
docker compose down

# Replace database file
cp ./backups/backup-20240101.db ./storage/kainban.db

# Start services
docker compose up -d
```

## Updates and Maintenance

### Updating kAInban

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f kainban-api
docker compose logs -f kainban-frontend
```

### Container Health

```bash
# Check container status
docker compose ps

# Check health endpoints
curl http://localhost:8064/health
curl http://localhost:3001/api/health
```

## Security Considerations

1. **Environment Variables**: Store sensitive data in `.env` file, never commit to version control
2. **File Permissions**: Ensure proper permissions on storage directory
3. **Network Security**: Use reverse proxy with SSL in production
4. **Database Security**: Regular backups and access control
5. **API Security**: Configure CORS origins properly
6. **OAuth Security**: Use HTTPS for OAuth callback URLs

## Support

For issues or questions:

- GitHub Issues: https://github.com/Qureshi-Inc/kAInban/issues
- Email: support@kainban.com
- Documentation: https://docs.kainban.com
