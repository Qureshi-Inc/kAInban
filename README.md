# kAInban - Organize Tasks with AI

> Transform audio recordings into actionable tasks with AI-powered transcription and intelligent task extraction. A modern, self-hosted task management system with privacy-first on-device audio processing.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Azure OpenAI](https://img.shields.io/badge/Azure-OpenAI-0078d4.svg)](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**kAInban** is an AI-powered task management application that transforms meeting recordings and audio notes into organized, actionable tasks on an intelligent Kanban board. Built with privacy-first principles, it processes audio locally in your browser while leveraging Azure OpenAI for transcription and task extraction.

**Perfect for:**
- 📝 Meeting notes and action items
- 🎯 Project planning and task breakdown
- 🤝 Team collaboration and task assignment
- 📊 Personal productivity and organization
- 🔒 Privacy-conscious users who self-host

---

## ✨ Features

### 🎤 **Audio Processing**
- **Live Recording** with real-time visualization and pause/resume
- **File Upload** supporting MP3, MP4, M4A, WAV, WebM, OGG, FLAC
- **Privacy-First**: Audio conversion happens locally in your browser
- **Large File Support**: Automatic chunking for recordings >25MB
- **Mobile Optimized**: Memory-efficient processing for mobile devices

### 🤖 **AI-Powered Intelligence**
- **Transcription Agent**: High-accuracy speech-to-text using Azure OpenAI Whisper
- **Task Extraction Agent**: Intelligent task detection with status recognition
  - Automatically detects: "blocked", "in-progress", "done", "todo"
  - Consolidates related activities into single tasks
  - Extracts due dates from natural language ("next week", "by Friday")
  - Identifies assignees and priorities
- **Summary Generation Agent**: Structured meeting summaries with action items
- **Related Tasks Agent**: Finds tasks that should be updated together

### 📋 **Task Management**
- **Kanban Board**: Drag-and-drop interface with To Do, In Progress, Blocked, Done columns
- **Rich Task Details**: Priority, status, assignee, due dates, descriptions with markdown
- **Project Organization**: Multiple projects with isolated tasks and meetings
- **Meeting Files**: Store and review past meeting transcripts and summaries

### 📱 **Modern UI/UX**
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Beautiful Animations**: Smooth Framer Motion transitions
- **Dark Mode Support**: System-aware theme switching
- **PWA Ready**: Install as a mobile app
- **Touch Optimized**: Mobile-first interactions

### 🔒 **Privacy & Security**
- **Self-Hosted**: Run on your own hardware with Docker
- **On-Device Processing**: Audio conversion happens in your browser
- **Data Control**: Your data stays on your infrastructure
- **No Tracking**: Zero third-party analytics or tracking

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Docker** (for containerized deployment)
- **Azure OpenAI** account with Whisper and GPT-4 deployments

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kainban.git
   cd kainban
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Azure OpenAI credentials:
   ```env
   VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   VITE_AZURE_OPENAI_API_KEY=your-api-key-here
   VITE_WHISPER_DEPLOYMENT_NAME=whisper-1
   VITE_GPT_DEPLOYMENT_NAME=gpt-4
   VITE_AZURE_OPENAI_API_VERSION=2024-06-01
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Access at: `http://localhost:8064`

### Docker Deployment

**Quick Start (Production):**
```bash
docker-compose up -d
```

**See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed deployment instructions.**

---

## 📚 Documentation

### Core Guides

- **[FEATURES.md](FEATURES.md)** - Comprehensive feature guide with detailed explanations of:
  - All AI agents and their capabilities
  - Audio processing pipeline
  - Task management system
  - Architecture and data flow
  - Performance optimizations
  - Configuration options

- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Complete Docker deployment guide:
  - Production deployment
  - Development setup
  - SSL/TLS configuration
  - Troubleshooting

### Configuration

**Azure OpenAI Setup:**
1. Create Azure OpenAI resource
2. Deploy **Whisper** model for transcription
3. Deploy **GPT-4** model for task extraction and summaries
4. Copy endpoint and API key to `.env`

**HTTPS for Microphone Access:**
Modern browsers require HTTPS for microphone access:
```bash
# Generate self-signed certificates (development)
./generate-certs.sh

# Or use ngrok for quick testing
ngrok http 8064
```

---

## 🗺️ Roadmap

### 🚧 In Development

- [ ] **Multi-Provider AI Support**
  - Anthropic Claude integration
  - Google Gemini integration
  - OpenAI direct integration
  - Local LLM support (Ollama, llama.cpp)
  - Hugging Face models

### 📋 Planned Features

**Authentication & Users**
- [ ] User authentication system
- [ ] Multi-user support with role-based access
- [ ] Team collaboration features
- [ ] User profiles and preferences
- [ ] Shared projects and task assignment

**Mobile Experience**
- [ ] Native iOS app (React Native)
- [ ] Native Android app (React Native)
- [ ] Enhanced mobile UI/UX
- [ ] Offline mode with sync
- [ ] Push notifications

**UI Enhancements**
- [ ] List view for Kanban board
- [ ] Table view with sorting/filtering
- [ ] Calendar view for due dates
- [ ] Gantt chart for project timelines
- [ ] Customizable board columns
- [ ] Task templates

**Project Management**
- [ ] Project-specific URLs (`/project/:id`)
- [ ] Project sharing and collaboration
- [ ] Project templates
- [ ] Project analytics and insights
- [ ] Time tracking per task
- [ ] Project milestones

**API & Integrations**
- [ ] Public REST API
- [ ] Webhook support
- [ ] Zapier integration
- [ ] Slack integration
- [ ] Microsoft Teams integration
- [ ] Calendar sync (Google Calendar, Outlook)
- [ ] Email notifications

**Advanced AI Features**
- [ ] Custom AI agent prompts
- [ ] Fine-tuned models for specific use cases
- [ ] Sentiment analysis in meetings
- [ ] Speaker diarization (who said what)
- [ ] Meeting insights and analytics
- [ ] Automatic follow-up reminders

**Data & Export**
- [ ] Export projects to JSON/CSV
- [ ] Import from other task managers (Trello, Asana, Jira)
- [ ] Backup and restore functionality
- [ ] Data visualization dashboards
- [ ] Advanced search and filtering

**Performance**
- [ ] Web Worker for audio processing
- [ ] Virtual scrolling for large task lists
- [ ] Optimistic UI updates
- [ ] Background sync
- [ ] Progressive Web App enhancements

**Security**
- [ ] End-to-end encryption for sensitive data
- [ ] Two-factor authentication (2FA)
- [ ] Audit logs
- [ ] Session management
- [ ] API rate limiting

### 🎯 Future Considerations

- [ ] Voice commands for task creation
- [ ] Real-time collaboration (WebRTC)
- [ ] Video meeting integration (Zoom, Meet)
- [ ] AI-powered task prioritization
- [ ] Smart notifications based on context
- [ ] Browser extensions (Chrome, Firefox)
- [ ] Desktop apps (Electron)
- [ ] Custom branding/white-label

---

## 🏗️ Architecture

**Technology Stack:**
- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui
- **State**: Zustand, React Query
- **Animation**: Framer Motion
- **Storage**: IndexedDB (browser), Docker volumes (self-hosted)
- **AI**: Azure OpenAI (Whisper, GPT-4)
- **Audio**: Web Audio API (client-side processing)
- **Deployment**: Docker, Nginx

**Project Structure:**
```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI (shadcn/ui)
│   ├── AudioControls.jsx
│   ├── KanbanBoard.jsx
│   └── ...
├── services/           # External integrations
│   ├── audioService.js
│   ├── openaiService.js
│   └── storageService.js
├── stores/             # Zustand state
└── lib/                # Utilities
```

**See [FEATURES.md](FEATURES.md) for detailed architecture diagrams and data flow.**

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** if applicable
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

**Development Guidelines:**
- Follow existing code style
- Write meaningful commit messages
- Update documentation for new features
- Test on both desktop and mobile
- Check for security vulnerabilities

---

## 🔍 Troubleshooting

### Common Issues

**Microphone Access Denied:**
- Ensure HTTPS (run `./generate-certs.sh`)
- Check browser permissions
- Try different browser

**M4A Upload Fails:**
- File may be >100MB (unsupported)
- Try converting to MP3 first
- Check console for detailed errors

**Mobile Transcription Timeout:**
- File too large for mobile
- Use desktop for large files
- Check network connection

**Task Extraction Returns Empty:**
- Transcript too short
- No actionable items detected
- Use more explicit language in meetings

**See [FEATURES.md](FEATURES.md) for detailed troubleshooting guide.**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Azure OpenAI** for powerful AI models
- **shadcn/ui** for beautiful UI components
- **Vercel** for Tailwind CSS and design inspiration
- **Open source community** for amazing tools and libraries

---

## 📧 Support

**Need help?**
1. Check [FEATURES.md](FEATURES.md) for detailed documentation
2. Review [GitHub Issues](../../issues)
3. Create a new issue with detailed information

**Commercial support:**
For enterprise support, custom features, or consulting, contact us at [your-email@example.com]

---

<div align="center">

**Built with ❤️ using React, Azure OpenAI, and modern web technologies**

[⭐ Star us on GitHub](../../stargazers) | [🐛 Report Bug](../../issues) | [💡 Request Feature](../../issues)

</div>
