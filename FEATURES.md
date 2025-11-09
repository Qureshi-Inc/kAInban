# kAInban - Feature Guide

## Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [AI Agents & Processing](#ai-agents--processing)
- [Audio Processing](#audio-processing)
- [Task Management](#task-management)
- [Project Management](#project-management)
- [Architecture](#architecture)

---

## Overview

kAInban is an AI-powered task management application that transforms audio recordings and uploads into actionable tasks on an intelligent Kanban board. It leverages Azure OpenAI services for transcription and intelligent task extraction, with privacy-first on-device audio processing.

---

## Core Features

### 🎤 Audio Recording & Upload

**Live Recording:**
- Real-time audio recording with browser microphone access
- Audio visualization during recording
- Pause/resume functionality
- Automatic chunking for recordings over 10 minutes
- Memory-optimized processing for mobile devices

**File Upload:**
- Support for multiple audio formats: MP3, MP4, M4A, WAV, WebM, OGG, FLAC
- Automatic M4A to WAV conversion with compression (48kHz → 16kHz mono)
- File size validation (25MB limit for Azure OpenAI Whisper)
- Large file chunking (automatic splitting for files >25MB)

**Mobile Support:**
- Optimized timeout handling (5 min mobile, 10 min desktop)
- Aggressive memory optimization for mobile browsers
- Mobile-specific error messages and debugging

---

## AI Agents & Processing

### 1. Transcription Agent (Azure OpenAI Whisper)

**Purpose:** Convert audio to text with high accuracy

**Features:**
- Language: English (configurable)
- API Version: 2024-06-01 (latest stable)
- Timeout protection with AbortController
- Chunked transcription for large files (10-minute segments)
- Mobile-optimized timeout limits

**Configuration:**
```env
VITE_AZURE_OPENAI_ENDPOINT=your-azure-endpoint
VITE_AZURE_OPENAI_API_KEY=your-api-key
VITE_WHISPER_DEPLOYMENT_NAME=whisper-1
```

**Processing Pipeline:**
```
Audio File → M4A Conversion (if needed) → Chunking (if >25MB) →
Whisper API → Raw Transcript → Storage
```

---

### 2. Task Extraction Agent (Azure OpenAI GPT-4)

**Purpose:** Extract actionable tasks from meeting transcripts with intelligent status detection

**Capabilities:**
- ✅ **Status Detection:** Automatically identifies task status from keywords
  - "blocked" / "on hold" / "stuck" → `blocked`
  - "completed" / "done" / "finished" → `done`
  - "working on" / "in progress" → `in-progress`
  - "need to" / "will" / "should" → `todo`

- ✅ **Task Consolidation:** Groups related activities into single tasks with sub-tasks
- ✅ **Existing Task Matching:** Updates existing tasks instead of creating duplicates
- ✅ **Priority Detection:** Assigns high/medium/low priority based on context
- ✅ **Due Date Parsing:** Extracts dates from natural language
  - "next week" → ISO date 7 days ahead
  - "by Friday" → Next Friday's date
  - "tomorrow" → ISO date next day
  - "end of month" → Last day of current month

- ✅ **Assignee Detection:** Identifies person assigned to task if mentioned
- ✅ **Sub-task Parsing:** Creates bullet-pointed sub-tasks from descriptions

**Prompt Design:**
The agent uses a specialized system prompt that:
1. Analyzes RAW TRANSCRIPT (not summary) for accuracy
2. Consolidates related activities into single tasks
3. Detects and matches existing tasks by topic/project
4. Provides update deltas for matched tasks
5. Returns structured JSON with all task metadata

**Configuration:**
```env
VITE_GPT_DEPLOYMENT_NAME=gpt-4
```

**Example Output:**
```json
[
  {
    "title": "Family Night Event Planning",
    "description": "Organize family night event with following sub-tasks:\n• Confirm date with Brother Hanif\n• Plan activities and games\n• Arrange venue setup\n• Send invitations to family members",
    "priority": "high",
    "status": "in-progress",
    "assignee": "Sarah",
    "dueDate": "2024-11-15"
  }
]
```

---

### 3. Summary Generation Agent (Azure OpenAI GPT-4)

**Purpose:** Create structured meeting summaries from transcripts

**Output Format:**
```markdown
## Key Discussion Points
- [Main topics discussed - specific and detailed]

## Decisions Made
- [Concrete decisions or agreements reached]

## Action Items
**[Project/Topic Name]:**
- [Sub-task 1: specific action needed]
- [Timeline: if mentioned]
- [Assigned to: if mentioned]

## Next Steps
- [Planned future actions or meetings]
```

**Features:**
- Groups related tasks under project/topic headings
- Breaks down complex topics into specific sub-tasks
- Includes timelines and assignments when mentioned
- Maintains consistent markdown formatting

---

### 4. Related Tasks Analysis Agent (Azure OpenAI GPT-4)

**Purpose:** Identify tasks that should be updated together when one is completed

**Use Case:**
When marking a task as complete, this agent finds related tasks that:
1. Are part of the same project/topic
2. Are sub-components of the same overall goal
3. Would logically be completed together

**Output:**
Returns array of task indices (1-based) that should be updated or completed together.

---

## Audio Processing

### Client-Side Processing (Privacy-First)

**Why Client-Side?**
- Audio format conversion happens in browser using Web Audio API
- Raw audio never leaves device until converted to API-compatible format
- Reduces server load and bandwidth
- Marketing angle: "Privacy-First, On-Device Processing"

**Processing Steps:**

1. **Audio Capture**
   ```javascript
   MediaRecorder → Audio Chunks → Blob
   ```

2. **M4A to WAV Conversion** (if needed)
   ```javascript
   File → ArrayBuffer → AudioContext.decodeAudioData() →
   Resample (48kHz → 16kHz mono) → WAV Encoding → Compressed File
   ```

3. **Memory Optimization**
   - Aggressive nullification of large typed arrays after each step
   - Step-by-step garbage collection hints
   - Mobile-specific memory warnings for files >20MB

4. **Chunking Logic** (files >25MB)
   ```javascript
   AudioBuffer → Split into 10-min chunks →
   Process each chunk → Combine transcripts
   ```

**Memory Footprint:**
- Original M4A: 30MB
- ArrayBuffer (decoded): ~95MB
- Resampled (16kHz mono): ~19MB
- Final WAV: ~19MB
- Peak usage: ~285MB (with aggressive cleanup: ~150MB)

---

## Task Management

### Kanban Board

**Columns:**
- 📋 **To Do** - Pending tasks
- 🚀 **In Progress** - Active tasks
- 🚫 **Blocked** - Blocked/on-hold tasks
- ✅ **Done** - Completed tasks

**Features:**
- ✅ Drag-and-drop between columns
- ✅ Visual task cards with priority indicators
- ✅ Task count per column
- ✅ Smooth animations with Framer Motion
- ✅ Responsive design (desktop & mobile)

### Task Detail Modal

**Information:**
- Title and description
- Status and priority
- Assignee (if assigned)
- Due date (if set)
- Creation and update timestamps
- Markdown support for descriptions

**Actions:**
- Edit task details
- Change status
- Update priority
- Set/change assignee
- Set/change due date
- Delete task

### Task Operations

**Create Task:**
- Extract from transcript using AI agent
- Manual creation via UI
- Bulk creation from meeting transcription

**Update Task:**
- Drag-and-drop status change
- Modal edit with full field support
- AI-suggested updates when new transcript processed

**Delete Task:**
- Single task deletion
- Related task detection (optional cascade)

---

## Project Management

### Project System

**Features:**
- ✅ Multiple independent projects
- ✅ Project-specific tasks and meetings
- ✅ Quick project switching
- ✅ Project creation and deletion
- ✅ Isolated data storage per project

**Project Structure:**
```javascript
{
  id: "uuid",
  name: "Project Name",
  createdAt: "ISO date",
  meetings: [...],  // Project-specific meetings
  tasks: [...]      // Project-specific tasks
}
```

**Storage:**
- Projects stored in browser IndexedDB
- Self-hosted: Docker volume persistence
- Automatic sync with storage service

### Meeting Files

**Features:**
- ✅ Meeting list panel with timestamps
- ✅ Select meeting to view transcript/summary/tasks
- ✅ Delete meetings
- ✅ Automatic naming with timestamp

**Meeting Structure:**
```javascript
{
  id: "uuid",
  name: "Meeting YYYY-MM-DD HH:MM",
  transcript: "full transcript text",
  summary: "generated summary",
  createdAt: "ISO date",
  audioBlob: Blob  // Original audio (optional)
}
```

---

## Architecture

### Technology Stack

**Frontend:**
- React 18 with Vite
- Zustand for state management
- Framer Motion for animations
- Tailwind CSS + shadcn/ui components
- React Beautiful DnD for drag-and-drop

**Backend/Services:**
- Azure OpenAI (Whisper + GPT-4)
- Web Audio API (client-side processing)
- IndexedDB (browser storage)
- Docker (self-hosted deployment)

**Infrastructure:**
- Docker Compose orchestration
- Nginx reverse proxy
- Cloudflare Tunnel (optional)
- Self-hosted on local hardware

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                      │
│  (React Components + Zustand State Management)          │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  Audio Service  │    │  Storage Service │
│  (Web Audio)    │    │  (IndexedDB)     │
└────────┬────────┘    └────────┬─────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────────┐
│  OpenAI Service │    │  Docker Volumes  │
│  (Azure API)    │    │  (Persistence)   │
└─────────────────┘    └──────────────────┘
```

### Storage Architecture

**Browser (IndexedDB):**
- Projects metadata
- Meeting metadata
- Task data
- UI state

**Docker Volumes (Self-Hosted):**
- Persistent database
- Audio file storage (if saved)
- Application logs
- SSL certificates

**Privacy Model:**
- Audio conversion: Client-side (browser)
- AI processing: Azure OpenAI (API calls only)
- Data storage: Self-hosted (your hardware)
- No third-party analytics or tracking

---

## Performance Optimizations

### Mobile Optimizations

**Memory Management:**
- Aggressive cleanup after each processing step
- Early nullification of large objects
- Mobile-specific warnings for large files
- Memory profiling during M4A conversion

**Network Handling:**
- Reduced timeout (5 min vs 10 min desktop)
- Mobile-specific error messages
- Connection stability detection
- Retry logic for unstable connections

**UI Optimizations:**
- Responsive layouts
- Touch-friendly controls
- Progressive loading
- Optimistic UI updates

### Desktop Optimizations

**Audio Processing:**
- Parallel chunk processing
- Web Worker support (future)
- Hardware acceleration via Web Audio API

**UI Performance:**
- Virtual scrolling for large task lists (future)
- Debounced search and filters
- Memoized components
- Lazy loading of heavy components

---

## Configuration

### Environment Variables

```env
# Azure OpenAI Configuration
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
VITE_AZURE_OPENAI_API_KEY=your-api-key-here
VITE_AZURE_OPENAI_API_VERSION=2024-06-01

# Deployment Names
VITE_WHISPER_DEPLOYMENT_NAME=whisper-1
VITE_GPT_DEPLOYMENT_NAME=gpt-4

# Application Settings
VITE_APP_NAME=kAInban
VITE_APP_VERSION=1.0.0
```

### Customization Options

**Audio Settings:**
- Sample rate: 16kHz (default) - configurable in audioService.js
- Chunk duration: 10 minutes (600 seconds)
- Max file size: 25MB (Azure limit)

**AI Settings:**
- Temperature: 0.1 (task extraction), 0.5 (summary)
- Max tokens: 2000 (tasks), 800 (summary)
- Language: English (configurable in openaiService.js)

**UI Settings:**
- Theme: Light/Dark (system default)
- Animations: Enabled (configurable)
- Notification duration: 3 seconds

---

## Security & Privacy

### Data Protection

**Secrets Management:**
- Environment variables for API keys
- No hardcoded credentials
- .gitignore for sensitive files
- .env.example for safe sharing

**Data Privacy:**
- Audio processing in browser
- Self-hosted data storage
- No third-party tracking
- Optional audio deletion after transcription

### Network Security

**API Communication:**
- HTTPS only
- API key authentication
- Request timeout protection
- Error message sanitization

**Storage Security:**
- Browser sandboxing (IndexedDB)
- Docker volume isolation
- File permission management
- Optional SSL/TLS certificates

---

## Troubleshooting

### Common Issues

**1. Microphone Access Denied**
- Requires HTTPS or localhost
- Check browser permissions
- Try different browser

**2. M4A Upload Fails**
- File may be too large (>100MB)
- Unsupported codec
- Try converting to MP3 first

**3. Mobile Transcription Timeout**
- File too large for mobile
- Unstable connection
- Use desktop for large files

**4. Task Extraction Returns Empty**
- Transcript too short
- No actionable items detected
- Try more explicit language

### Debug Mode

Enable console logging to troubleshoot:
```javascript
// All services log to console with prefixes:
// [AudioService] - Audio processing
// [OpenAI] - API calls
// [StorageService] - Data operations
```

---

## Future Enhancements

See [README.md](README.md) for the full roadmap including:
- Multi-provider AI support (Anthropic, Gemini, Local LLMs)
- User authentication and multi-user support
- Native mobile apps (iOS/Android)
- List view for Kanban board
- Project-specific URLs
- Public API
- And more...
