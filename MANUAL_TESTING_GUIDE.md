# Manual Testing with Automated Capture

This system lets you play the game normally while automatically capturing screenshots, logs, and video for later analysis. Perfect for debugging tricky issues!

## Quick Start

```bash
# Start the live server first
npx live-server --port=5501 --no-browser

# In another terminal, run manual testing with auto-capture
npx playwright test manual-testing-with-auto-capture.spec.js --headed
```

## What Gets Captured Automatically

### 📸 Screenshots
- **Full session**: One screenshot every 3 seconds
- **Quick test**: One screenshot every 2 seconds  
- **Naming**: `screenshot-001-15s.png` (number + elapsed time)
- **Quality**: High-resolution PNG files

### 📝 Console Logs
- **Real-time monitoring**: All console messages captured
- **Structured data**: JSON format with timestamps, types, locations
- **Continuous saving**: Logs saved every 5 seconds during session
- **Types captured**: Errors, warnings, info, debug messages

### 🎬 Video Recording
- **Full session video**: Complete playthrough recorded
- **Format**: WebM video files
- **Quality**: 1280x720 at game framerate
- **Location**: Saved with screenshots in session folder

### 📊 Game State Snapshots
- **Player data**: Position, health, status
- **Game metrics**: Enemy count, bullet count, frame rate
- **Timing**: Captured every 10 seconds
- **Format**: JSON files for easy analysis

## Usage Options

### 🎮 Full Session (5 minutes)
```bash
npx playwright test manual-testing-with-auto-capture.spec.js --headed --grep "Manual Testing Session"
```
- **Duration**: 5 minutes of gameplay
- **Screenshots**: ~100 images (every 3 seconds)
- **Best for**: Comprehensive bug investigation

### ⚡ Quick Test (1 minute)  
```bash
npx playwright test manual-testing-with-auto-capture.spec.js --headed --grep "Quick Manual Test"
```
- **Duration**: 1 minute of gameplay
- **Screenshots**: ~30 images (every 2 seconds)
- **Best for**: Quick issue verification

## Output Organization

Each session creates a timestamped folder in `tests/manual-sessions/`:

```
tests/manual-sessions/session-2024-12-21T15-30-45-123Z/
├── screenshot-001-3s.png      # Auto-captured screenshots
├── screenshot-002-6s.png      
├── screenshot-003-9s.png      
├── console-logs-1640098845123.json  # Periodic log dumps
├── game-state-1640098845456.json    # Game state snapshots
├── final-console-logs.json          # Complete log history
├── session-summary.json             # Session metrics
├── trace.zip                        # Playwright trace file
└── video.webm                       # Full session video
```

## How to Use for Debugging

1. **Start the system**: Run one of the commands above
2. **Play normally**: The browser opens - just play the game as usual
3. **Reproduce issues**: Try to trigger any bugs you want to investigate
4. **Let it capture**: Screenshots and logs are saved automatically
5. **Analyze results**: Review the generated files after the session

## Debugging Workflow

### When You Find a Bug:
1. Note the approximate time when it happened
2. Look for the corresponding screenshot (`screenshot-XXX-YYs.png`)
3. Check console logs around that timestamp
4. Review game state data for that period
5. Use video for exact sequence of events

### File Analysis:
- **Screenshots**: Visual evidence of what happened
- **Console logs**: Error messages and debug info
- **Game state**: Numerical data about game status
- **Video**: Complete sequence for frame-by-frame analysis
- **Trace file**: Detailed Playwright interaction data

## Advanced Configuration

### Customize Capture Timing
Edit `tests/manual-testing-with-auto-capture.spec.js`:

```javascript
const CAPTURE_DURATION = 300000; // Session length (ms)
const SCREENSHOT_INTERVAL = 3000; // Screenshot frequency (ms)
const LOG_CAPTURE_INTERVAL = 5000; // Log save frequency (ms)
```

### Focus on Specific Issues
- **Audio problems**: Check console logs for audio-related errors
- **Visual glitches**: Use screenshots to see visual state
- **Performance issues**: Monitor game state for frame rate drops
- **Interaction bugs**: Use video to see exact click/key sequences

## Benefits Over Manual Recording

✅ **Automatic**: No need to remember to start recording  
✅ **Comprehensive**: Captures data you might miss manually  
✅ **Organized**: Timestamped files make analysis easy  
✅ **Detailed**: Gets console logs and game state data  
✅ **Reliable**: Consistent capture intervals  
✅ **Searchable**: JSON logs can be filtered and analyzed  

## Tips for Effective Testing

1. **Focus on one issue at a time** during each session
2. **Try edge cases** - move to screen edges, spam buttons
3. **Test different game states** - various enemy counts, low health
4. **Use browser dev tools** alongside for real-time debugging
5. **Keep sessions focused** - shorter targeted tests often better than long sessions

## Troubleshooting the Testing System

### If screenshots aren't saving:
- Check that `tests/manual-sessions/` directory is writable
- Ensure sufficient disk space
- Verify Playwright permissions

### If video isn't recording:
- Check Playwright config has `video: 'on'`
- Ensure browser supports video recording
- Try running with `--headed` flag

### If console logs are empty:
- Verify the game is actually running
- Check browser console manually first
- Ensure no script blockers are interfering

This system gives you the power of automated capture with the flexibility of manual control - the best of both worlds for debugging! 