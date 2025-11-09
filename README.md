# Audio Task Manager

A modern, mobile-friendly web application that transcribes audio recordings and automatically organizes them into actionable tasks on a kanban board. Built with React, Vite, and Azure OpenAI.

## ✨ Features

- **🎤 Audio Recording**: In-app recording with real-time visualization
- **📁 File Upload**: Support for various audio file formats
- **🤖 AI Transcription**: Azure OpenAI Whisper integration
- **📋 Smart Task extraction**: AI-powered task generation from transcripts
- **📱 Mobile-Friendly Kanban**: Touch-optimized drag-and-drop interface
- **💾 Project Management**: Persistent project storage with IndexedDB
- **📝 Meeting Summaries**: AI-generated meeting notes
- **🔒 HTTPS Support**: Microphone permissions handled correctly
- **🐳 Docker Ready**: Easy deployment with Docker

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Azure OpenAI account with Whisper and GPT-4 deployments

### 1. Clone and Install

```bash
git clone <your-repo>
cd audio-task-manager
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Azure OpenAI credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
VITE_AZURE_OPENAI_API_KEY=your-api-key-here
VITE_AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
VITE_AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4
```

### 3. Development Server

**Option A: Standard HTTP (localhost only)**
```bash
npm run dev
```
Access at: http://localhost:8064

**Option B: HTTPS (for microphone access)**
```bash
# Generate self-signed certificates
./generate-certs.sh

# Start with HTTPS
npm run dev
```
Access at: https://localhost:8064 (accept certificate warning)

## 🐳 Docker Deployment

### Development with Docker
```bash
# Start development environment
docker-compose --profile dev up

# Or build and run directly
docker build -f Dockerfile.dev -t audio-task-manager-dev .
docker run -p 8064:8064 -v $(pwd):/app audio-task-manager-dev
```

### Production with Docker
```bash
# Build and start production
docker-compose up -d

# Or manually
docker build -t audio-task-manager .
docker run -p 8064:8064 audio-task-manager
```

## 📱 Mobile Usage

The app is optimized for mobile devices:

- **Touch-friendly**: All buttons and interactions are touch-optimized
- **Responsive**: Works on phones, tablets, and desktops
- **PWA Ready**: Can be installed as a mobile app
- **Offline Support**: Project data stored locally

## 🔧 Configuration

### Azure OpenAI Setup

1. Create an Azure OpenAI resource
2. Deploy Whisper model for transcription
3. Deploy GPT-4 model for task extraction
4. Copy endpoint and API key to `.env`

### HTTPS for Microphone Access

Modern browsers require HTTPS for microphone access. Use one of these approaches:

1. **Self-signed certificates** (development):
   ```bash
   ./generate-certs.sh
   ```

2. **ngrok** (quick testing):
   ```bash
   npm install -g ngrok
   npm run dev  # in one terminal
   ngrok http 8064  # in another terminal
   ```

3. **Production**: Use a proper SSL certificate

## 🏗️ Architecture

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components (shadcn/ui)
│   ├── Header.jsx      # App header with project selection
│   ├── AudioControls.jsx    # Recording and upload controls
│   ├── TranscriptPanel.jsx  # Live transcription display
│   ├── KanbanBoard.jsx      # Drag-and-drop task board
│   └── ...
├── services/           # External service integrations
│   ├── audioService.js # Microphone and audio handling
│   └── openaiService.js # Azure OpenAI API client
├── stores/             # State management
│   └── useAppStore.js  # Zustand store
├── lib/                # Utilities
│   └── utils.js        # Helper functions
└── styles/             # CSS and styling
```

## 🔍 Troubleshooting

### Microphone Permission Issues

**Problem**: "Microphone access denied" error

**Solutions**:
1. Ensure you're using HTTPS (run `./generate-certs.sh`)
2. Check browser permissions in Settings > Privacy & Security
3. Try a different browser
4. On mobile, ensure the website is trusted

### Azure OpenAI Connection Issues

**Problem**: Transcription or task generation fails

**Solutions**:
1. Verify API key and endpoint in `.env`
2. Check Azure OpenAI deployment names match your config
3. Ensure your Azure subscription has sufficient quota
4. Check network connectivity

### Docker Issues

**Problem**: Container won't start

**Solutions**:
1. Ensure Docker is running
2. Check port 8064 is available
3. Review logs: `docker-compose logs`
4. Try rebuilding: `docker-compose build --no-cache`

## 📚 Development

### Project Structure

- **React 18** with modern hooks
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Zustand** for state management
- **Framer Motion** for animations
- **IndexedDB** for local storage

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Adding Features

1. **New UI Components**: Add to `src/components/ui/`
2. **Business Logic**: Add to `src/services/`
3. **State Management**: Extend `src/stores/useAppStore.js`
4. **Styling**: Use Tailwind classes or extend `src/index.css`

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the [GitHub Issues](issues)
3. Create a new issue with detailed information

---

Built with ❤️ using React, Azure OpenAI, and modern web technologies.# kAInban
