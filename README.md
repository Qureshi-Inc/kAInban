# kAInban - AI-Powered Task Management

> Transform meeting recordings into actionable tasks with AI-powered transcription and intelligent task extraction. A modern, privacy-first task management system with PocketID authentication and comprehensive project organization.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Azure OpenAI](https://img.shields.io/badge/Azure-OpenAI-0078d4.svg)](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg)](https://nodejs.org/)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## 🎯 Overview

**kAInban** is a comprehensive AI-powered task management application that transforms meeting recordings and audio notes into organized, actionable tasks on an intelligent Kanban board. Built with modern web technologies and designed for both personal productivity and team collaboration.

### Key Benefits

- 🎤 **Audio-to-Tasks**: Transform meeting recordings into structured task lists
- 🤖 **AI Intelligence**: Advanced task extraction with status detection and prioritization
- 📊 **Analytics Dashboard**: Gain insights into your productivity patterns with AI recommendations
- 🔒 **Privacy-First**: Self-hosted with optional PocketID authentication
- 📱 **Mobile-Optimized**: Responsive design that works on all devices
- 🎨 **Modern UI**: Beautiful, intuitive interface with dark mode support

### Perfect for:

- 📝 **Meeting Management**: Automatically extract action items from recordings
- 🎯 **Project Planning**: Break down complex projects into manageable tasks
- 🤝 **Team Collaboration**: Share projects and assign tasks to team members
- 📊 **Productivity Tracking**: Analyze work patterns with AI-powered insights
- 🔒 **Privacy-Conscious Users**: Complete control over your data

---

## ✨ Features

### 🎤 Audio Processing & AI Intelligence

- **Live Recording**: Real-time audio capture with visual feedback
- **File Upload Support**: MP3, MP4, M4A, WAV, WebM, OGG formats
- **AI Transcription**: High-accuracy speech-to-text using Azure OpenAI Whisper
- **Smart Task Extraction**: Intelligent detection of tasks, statuses, and priorities
- **Meeting Summaries**: Structured summaries with key decisions and action items
- **Large File Handling**: Automatic chunking for files >25MB

### 📋 Task & Project Management

- **Kanban Board**: Drag-and-drop interface with customizable columns
- **Project Organization**: Multiple projects with isolated tasks and settings
- **Rich Task Details**: Priorities, due dates, assignees, descriptions with markdown
- **Task Status Tracking**: Automatic status detection from meeting context
- **Related Task Detection**: AI identifies tasks that should be updated together

### 📊 Analytics & Insights

- **Analytics Dashboard**: Comprehensive overview of all projects and tasks
- **AI Task Recommendations**: Daily insights powered by intelligent analysis
  - 🎯 Focus recommendations for the week
  - ✅ Quick wins to build momentum
  - ⚠️ Urgent items requiring attention
- **Smart Caching**: Daily refresh with task count-based updates
- **Project Filtering**: View analytics for all projects or specific ones

### 🔐 Authentication & Security

- **PocketID Integration**: Modern OIDC authentication with group-based access control
- **Role-Based Access**: Admin and member roles with appropriate permissions
- **Group-Based Authorization**: Automatic role assignment based on PocketID groups
- **User Management**: Admin interface for managing users and permissions
- **Registration Control**: Configurable user registration policies

### 🎨 Modern User Experience

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Mode Support**: System-aware theme switching
- **Smooth Animations**: Beautiful transitions powered by Framer Motion
- **Progressive Web App**: Install as a mobile app with offline capabilities
- **Touch-Optimized**: Mobile-first interactions and gestures

### 🏗️ Technical Excellence

- **Docker Deployment**: Production-ready containerization
- **RESTful API**: Well-documented backend API
- **Real-time Updates**: Live synchronization across devices
- **Error Handling**: Comprehensive error management with user feedback
- **Performance Optimized**: Lazy loading, caching, and efficient rendering

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
- **Node.js 20+** (for development)
- **Azure OpenAI** account with Whisper and GPT deployments
- **PocketID** account (optional, for authentication)

### 1-Minute Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/kainban.git
cd kainban

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see Configuration section)

# Start with Docker
docker compose up -d

# Access at http://localhost:3000
```

---

## 🛠️ Installation

### Option 1: Docker (Recommended)

```bash
# Clone and navigate
git clone https://github.com/yourusername/kainban.git
cd kainban

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Build and start
docker compose up -d --build

# View logs
docker compose logs -f
```

### Option 2: Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/kainban.git
cd kainban

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev

# Access at http://localhost:3000
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# === Azure OpenAI Configuration (Required) ===
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
VITE_AZURE_OPENAI_API_KEY=your-api-key-here
VITE_AZURE_OPENAI_API_VERSION=2024-02-01
VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
VITE_AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4

# === PocketID Authentication (Optional) ===
ENABLE_OIDC=true
POCKET_ID_ISSUER=https://login.yourpocketid.com
POCKET_ID_CLIENT_ID=your-client-id
POCKET_ID_CLIENT_SECRET=your-client-secret
POCKET_ID_CALLBACK_URL=https://your-domain.com/api/auth/oidc/callback

# === Application Settings ===
ALLOW_REGISTRATION=true
APP_URL=https://your-domain.com
API_URL=https://your-domain.com/api

# === Database (SQLite) ===
# Database file will be created at ./storage/app.db
```

### Azure OpenAI Setup

1. **Create Azure OpenAI Resource**:
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a new Azure OpenAI resource
   - Note the endpoint URL and API key

2. **Deploy Models**:
   - Deploy **Whisper** model for transcription
   - Deploy **GPT-4** or **GPT-4o** for task extraction
   - Note the deployment names

3. **Update Configuration**:
   ```env
   VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   VITE_AZURE_OPENAI_API_KEY=your-api-key
   VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
   VITE_AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4o
   ```

### PocketID Authentication Setup

1. **Create PocketID Application**:
   - Sign up at [PocketID](https://pocketid.app)
   - Create a new application
   - Set callback URL: `https://your-domain.com/api/auth/oidc/callback`

2. **Configure Groups** (Optional):
   - `admin`: Users become app administrators
   - `user`: Users become regular members
   - `viewer`: Users are denied access (read-only, if implemented)

3. **Update Configuration**:
   ```env
   ENABLE_OIDC=true
   POCKET_ID_CLIENT_ID=your-client-id
   POCKET_ID_CLIENT_SECRET=your-client-secret
   POCKET_ID_CALLBACK_URL=https://your-domain.com/api/auth/oidc/callback
   ```

---

## 📱 Usage

### Getting Started

1. **First Login**:
   - If PocketID is enabled, click "Sign in with PocketID"
   - Otherwise, register with email/password
   - First user automatically becomes admin

2. **Configure AI Settings** (Admin):
   - Go to Settings → AI Settings
   - Enter Azure OpenAI credentials
   - Test connection to verify setup

3. **Create Your First Project**:
   - Click the project dropdown in header
   - Select "Create New Project"
   - Give it a descriptive name

### Recording & Processing Audio

1. **Live Recording**:
   - Click the microphone button
   - Allow microphone access when prompted
   - Speak naturally during your meeting
   - Click stop when finished

2. **File Upload**:
   - Click "Upload Audio File"
   - Select your recording (MP3, M4A, WAV, etc.)
   - Wait for processing to complete

3. **Review Results**:
   - Check the generated transcript
   - Review extracted tasks on the Kanban board
   - Read the meeting summary
   - Make any necessary edits

### Managing Tasks

1. **Kanban Board**:
   - Drag tasks between columns (To Do, In Progress, Blocked, Done)
   - Click tasks to edit details
   - Set priorities, due dates, and assignees

2. **Task Details**:
   - Add detailed descriptions with markdown
   - Set priority levels (High, Medium, Low)
   - Assign to team members
   - Set due dates for deadlines

3. **Project Organization**:
   - Switch between projects using header dropdown
   - Each project has isolated tasks and recordings
   - Use analytics dashboard for overview

### Analytics & Insights

1. **Dashboard View**:
   - Access from header when no project is selected
   - View completion rates, overdue tasks, and status distribution
   - Filter by specific projects or view all

2. **AI Recommendations**:
   - Get daily insights about task prioritization
   - Receive suggestions for quick wins
   - Identify urgent items needing attention
   - Recommendations refresh daily or when task count changes

### Admin Features

1. **User Management** (Admin only):
   - Settings → Users tab
   - View all registered users
   - See authentication methods (PocketID vs Email)
   - Delete users (except yourself)

2. **Authentication Settings** (Admin only):
   - Configure PocketID integration
   - Enable/disable user registration
   - Manage authentication providers

---

## 🔗 API Documentation

### Authentication

```bash
# Login with email/password
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# PocketID OAuth flow
GET /api/auth/oidc/login
GET /api/auth/oidc/callback
```

### Projects

```bash
# Get all projects
GET /api/projects

# Create project
POST /api/projects
{
  "name": "Project Name"
}

# Get project details
GET /api/projects/:id

# Delete project
DELETE /api/projects/:id
```

### Tasks

```bash
# Get tasks for project
GET /api/projects/:projectId/tasks

# Create task
POST /api/projects/:projectId/tasks
{
  "title": "Task title",
  "description": "Task description",
  "priority": "high",
  "status": "todo"
}

# Update task
PUT /api/tasks/:id
{
  "status": "in-progress",
  "assignee": "John Doe"
}
```

### Audio Processing

```bash
# Upload and process audio
POST /api/projects/:projectId/process-audio
Content-Type: multipart/form-data
- file: audio file
- filename: original filename
```

### User Management (Admin)

```bash
# Get all users
GET /api/users

# Delete user
DELETE /api/users/:id
```

---

## 🛠️ Development

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/kainban.git
cd kainban

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# In another terminal, start backend
cd server
npm install
npm run dev
```

### Tech Stack

**Frontend:**
- React 18 with Vite
- Tailwind CSS + shadcn/ui components
- Zustand for state management
- Framer Motion for animations
- Swiper.js for carousels

**Backend:**
- Node.js + Express
- SQLite database
- OpenID Connect (OIDC) authentication
- Multer for file uploads
- CORS and security middleware

**AI & Audio:**
- Azure OpenAI (Whisper + GPT-4)
- Web Audio API for client-side processing
- Automatic audio chunking for large files

**Deployment:**
- Docker + Docker Compose
- Nginx reverse proxy
- Multi-stage builds for optimization

### Project Structure

```
kainban/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components (shadcn/ui)
│   │   ├── Header.jsx     # Main navigation
│   │   ├── KanbanBoard.jsx# Task management board
│   │   ├── AnalyticsDashboard.jsx # Analytics and insights
│   │   └── ...
│   ├── services/          # API and external service integrations
│   │   ├── apiService.js  # Backend API client
│   │   ├── openaiService.js # Azure OpenAI integration
│   │   └── audioService.js# Audio processing utilities
│   ├── stores/            # Zustand state management
│   │   └── useAppStore.js # Main application state
│   └── lib/               # Utility functions
├── server/                # Backend Node.js application
│   ├── server.js          # Main server file
│   ├── database.js        # SQLite database setup
│   ├── oidcAuth.js        # PocketID authentication
│   └── routes/            # API route handlers
├── docker-compose.yml     # Production deployment
├── Dockerfile             # Multi-stage Docker build
├── package.json           # Dependencies and scripts
└── .env.example           # Environment template
```

### Building for Production

```bash
# Build frontend
npm run build

# Build Docker images
docker compose build

# Start production deployment
docker compose up -d
```

---

## 🚀 Deployment

### Docker Deployment (Recommended)

1. **Prepare Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Deploy with Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify Deployment**:
   ```bash
   docker compose logs -f
   curl http://localhost:3000/api/health
   ```

### Production Environment Variables

```env
# Production URLs
APP_URL=https://kainban.yourdomain.com
API_URL=https://kainban.yourdomain.com/api

# Security
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret

# Database
DATABASE_PATH=/app/storage/app.db

# OIDC Production Settings
POCKET_ID_CALLBACK_URL=https://kainban.yourdomain.com/api/auth/oidc/callback
```

### SSL/HTTPS Setup

For production deployment with SSL:

1. **Use reverse proxy** (Nginx, Traefik, Cloudflare)
2. **Configure SSL certificates** (Let's Encrypt recommended)
3. **Update callback URLs** in PocketID configuration
4. **Ensure HTTPS** for microphone access

Example Nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name kainban.yourdomain.com;

    ssl_certificate /etc/ssl/certs/kainban.crt;
    ssl_certificate_key /etc/ssl/private/kainban.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring & Maintenance

```bash
# View application logs
docker compose logs -f

# Update application
git pull
docker compose build --no-cache
docker compose up -d

# Backup database
docker exec kainban-api-1 cp /app/storage/app.db /app/storage/backup-$(date +%Y%m%d).db

# Monitor resource usage
docker stats
```

---

## 🤝 Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) guide for detailed information on:

- Development setup
- Coding standards
- Pull request process
- Issue reporting
- Feature requests

### Quick Start for Contributors

```bash
# Fork the repository
git clone https://github.com/yourusername/kainban.git
cd kainban

# Create feature branch
git checkout -b feature/amazing-feature

# Make your changes
# ... code, test, document ...

# Commit with descriptive message
git commit -m "Add amazing feature that does X"

# Push and create PR
git push origin feature/amazing-feature
```

### Areas for Contribution

- 🎨 **UI/UX improvements**
- 🤖 **AI agent enhancements**
- 📱 **Mobile experience**
- 🔒 **Security improvements**
- 📊 **Analytics features**
- 🌐 **Internationalization**
- 📚 **Documentation**
- 🧪 **Testing coverage**

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

### What this means:

- ✅ **Free to use, modify, and distribute**
- ✅ **Commercial use allowed**
- ✅ **Patent rights granted**
- ⚠️ **Must disclose source code** when distributing
- ⚠️ **Network use constitutes distribution** (AGPL requirement)
- ⚠️ **Same license for derivative works**

### Key AGPL Requirements:

If you run a modified version of kAInban on a server and provide access to users over a network, you **must** provide those users with access to the source code of your modified version.

For more details, see the [LICENSE](LICENSE) file.

### Commercial Licensing

For commercial use without AGPL restrictions, please contact us about commercial licensing options.

---

## 🙏 Acknowledgments

- **Azure OpenAI** for powerful AI capabilities
- **PocketID** for modern authentication
- **shadcn/ui** for beautiful, accessible components
- **Tailwind CSS** for rapid styling
- **React** and **Vite** for excellent developer experience
- **Open source community** for inspiration and tools

---

## 📧 Support

### Community Support

- 📖 **Documentation**: Start with this README and [CONTRIBUTING.md](CONTRIBUTING.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/kainban/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/yourusername/kainban/discussions)
- 💬 **Community Chat**: Join our Discord/Slack (link coming soon)

### Getting Help

1. **Check existing documentation** and closed issues
2. **Search the GitHub issues** for similar problems
3. **Create a detailed issue** with steps to reproduce
4. **Join community discussions** for general questions

### Commercial Support

For enterprise support, custom development, or consulting services:
- 📧 Email: support@kainban.com
- 💼 Enterprise features and SLAs available
- 🎯 Custom AI agent development
- 🔧 Installation and configuration assistance

---

<div align="center">

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/kainban&type=Date)](https://star-history.com/#yourusername/kainban&Date)

---

**Built with ❤️ by InterestingSoup**

*Transform your meetings into action with AI-powered task management*

[⭐ Star on GitHub](https://github.com/yourusername/kainban) •
[🐛 Report Bug](https://github.com/yourusername/kainban/issues) •
[💡 Request Feature](https://github.com/yourusername/kainban/issues) •
[📖 Documentation](https://github.com/yourusername/kainban/wiki)

</div>