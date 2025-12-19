# Development Principles

## 🚨 CRITICAL: DO NOT BREAK WORKING FEATURES

### Core Functionality Protection (NEVER BREAK)
- **Task Management**: Creation, display, editing, deletion, status changes
- **Audio Processing**: Upload → Convert → Transcribe → Extract Tasks
- **Subtask System**: Parsing, creation, completion, unique IDs
- **Project Management**: Creation, loading, switching, persistence
- **Real-time Updates**: Changes must persist through page reloads

### Development Safety Rules
- **Only change what's requested** - If asked to change URLs, only touch routing code
- **Never touch core systems** unless explicitly asked
- **No refactoring, optimization, or "improvements"** unless explicitly requested
- **Keep changes minimal and isolated** - Change only the specific files/lines needed
- **Think twice before implementing** - Always assess impact first

## 🛡️ MANDATORY SAFETY PROTOCOL

### Before Making ANY Changes:

#### 1. Impact Assessment (REQUIRED)
Ask these questions:
- Does this change affect task creation, display, or management?
- Does this change affect audio/recording functionality?
- Does this change affect subtask parsing or management?
- Does this change affect project loading or persistence?
- Does this change affect database schema or queries?
- Could this change break existing user workflows?

**If ANY answer is "YES" or "MAYBE" → Follow full safety protocol**

#### 2. Safety Steps for Core Changes
1. Read the current implementation completely
2. Understand all related functions and dependencies
3. Create minimal, targeted changes only
4. Test each change incrementally
5. Never change multiple core systems simultaneously
6. Always maintain backward compatibility

### 3. Testing Checklist (Run After ANY Code Changes)
```
🧪 CORE FUNCTIONALITY TEST:

Audio Upload Flow:
□ Upload audio file → verify transcription works
□ Verify tasks are extracted from transcription
□ Verify subtasks are parsed from task descriptions
□ Verify tasks appear in kanban board
□ Verify task modal opens when clicking tasks

Manual Task Flow:
□ Create task manually → verify it appears
□ Edit task → verify changes persist
□ Delete task → verify it's removed
□ Add subtasks → verify they work independently

Project Flow:
□ Create new project → verify it saves
□ Switch between projects → verify data loads correctly
□ Delete project → verify it's removed permanently

Paste Text Flow:
□ Paste text with bullet points → verify tasks + subtasks created

Recording Flow:
□ Start/stop recording → verify it works
□ Verify transcription → task extraction works

If ANY test fails → STOP and fix before continuing
```

## Core Features to Avoid (unless explicitly requested)

- Audio recording (AudioControls.jsx, RecordingModal.jsx)
- Audio segmentation and upload (audioService.js, transcriptionQueue.js)
- Transcription (openaiService.js, whisper endpoints)
- Task extraction (AI processing)
- Subtask parsing (lib/utils.js parseSubtasksFromDescription)
- Task creation (useAppStore addTask, createTask)
- Project loading/switching (useAppStore loadProject)
- Database operations (server/database.js, backend APIs)
- Task modal functionality (TaskDetailModal.jsx)

## ❌ NEVER DO THESE:
- Remove or rename existing store functions without updating all usage
- Change function signatures for core functions
- Modify database schemas without proper migration planning
- Change the structure of core data objects (task, project, etc.)
- Remove existing component props without updating all parents
- Modify core utility functions that other systems depend on

## ✅ SAFE ALTERNATIVES:
- Add new optional parameters with default values
- Create new functions alongside existing ones
- Add new optional fields to data objects
- Create new components that extend existing ones

## If Unsure

Ask the user: "This change might affect [specific core feature]. Should I proceed or find another approach?"

Remember: **It's better to make multiple small, safe changes than one large risky change.**
