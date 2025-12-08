# Critical Functionality Testing Protocol

## 🚨 **MANDATORY TESTS Before Any Recording/Audio Changes**

### **Core Functionality That Must NEVER Break:**
1. **Background chunk transcription** (10+ minute recordings)
2. **Chunk rotation and completion callbacks**
3. **Real-time transcription during long recordings**
4. **Audio blob creation and processing**
5. **Meeting creation with transcript/summary**

### **Test Checklist:**

#### **Quick Test (5 minutes):**
- [ ] Start recording → Wait 30 seconds → Pause → Resume → Stop
- [ ] Verify: Timer works, audio captured, transcript generated
- [ ] Check console for chunk rotation logs

#### **Long Recording Test (12+ minutes) - CRITICAL:**
- [ ] Start recording → Let run for 12+ minutes with some pauses
- [ ] Verify: Background transcription messages appear
- [ ] Verify: "Chunk X transcribed" logs in console
- [ ] Verify: Final transcript combines all chunks correctly
- [ ] Verify: No missing audio segments

#### **Error Scenarios:**
- [ ] Pause during chunk rotation (around 10min mark)
- [ ] Multiple rapid pause/resume cycles
- [ ] Browser tab backgrounding during recording
- [ ] Network interruption during background transcription

### **Before ANY Commit:**
1. **Run long recording test** (non-negotiable for audio changes)
2. **Check all console logs** for errors
3. **Verify background transcription is working**
4. **Test pause/resume at critical timing (9-11 minute mark)**

### **Log Monitoring:**
Watch for these critical logs:
```
[AudioService] === CHUNK ROTATION START ===
[AudioControls] Chunk X completed, queuing for background transcription
[AudioControls] Chunk X transcription completed
[AudioService] Background transcription active
```

**If these logs stop appearing during long recordings = BROKEN**

### **Red Flags - Immediate Investigation Required:**
- ❌ No chunk rotation after 10 minutes
- ❌ Background transcription stops working
- ❌ Missing chunks in final transcript
- ❌ "All chunks were already transcribed" message doesn't appear
- ❌ Chunk timer stops running (check with `audioService.chunkTimer`)

### **Development Rules:**
1. **Never touch chunk timer management** without full long-recording test
2. **Pause/resume should only affect MediaRecorder state**
3. **All timing adjustments must preserve chunk rotation**
4. **Test on actual 15+ minute recordings, not just short ones**

---

**Remember: Breaking background transcription in production would lose users' long meeting recordings forever. This is unacceptable.**