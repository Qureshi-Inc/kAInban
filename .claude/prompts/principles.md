# Development Principles

## CRITICAL: DO NOT BREAK WORKING FEATURES

- **Only change what's requested** - If asked to change URLs, only touch routing code
- **Never touch audio recording/transcription logic** unless explicitly asked
- **Never touch upload/segmentation logic** unless explicitly asked
- **No refactoring, optimization, or "improvements"** unless explicitly requested
- **Keep changes minimal and isolated** - Change only the specific files/lines needed

## Before Making Changes

1. Read the relevant code first to understand what exists
2. Ask if unsure whether a change might affect core features
3. Test assumptions before implementing

## Core Features to Avoid (unless explicitly requested)

- Audio recording (AudioControls.jsx, RecordingModal.jsx)
- Audio segmentation and upload (audioService.js, transcriptionQueue.js)
- Transcription (openaiService.js, whisper endpoints)
- Task extraction (AI processing)
- Database operations (backend APIs)

## If Unsure

Ask the user: "This change might affect [feature]. Should I proceed or find another approach?"
