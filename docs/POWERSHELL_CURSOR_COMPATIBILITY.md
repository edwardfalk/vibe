# PowerShell & PSReadLine Compatibility with Cursor IDE

## Current Status: RESOLVED ✅

**Root Cause Found:** PowerShell was crashing with exit code -1073741571 due to PSReadLine 2.0.0 trying to use `-PredictionSource` parameter that doesn't exist in that version.

**Emergency Fix Applied:** ✅ Version-safe PowerShell profile created  
**Crash Issue:** ✅ FIXED - No more exit code -1073741571

## PSReadLine Version Strategy

Given past instability with PSReadLine 2.3.6 in Cursor IDE, we're taking a targeted approach:

### ✅ RECOMMENDED: Try PSReadLine 2.4.2-beta2

**Why this version specifically:**
- **Cursor Position Fix:** "Avoid querying for cursor position when it's not necessary" (#4448)
- **Buffer Handling:** "Handle buffer changes made by an event handler" (#4442)  
- **Initialization Safety:** "Add a private field to indicate if PSReadLine is initialized and ready" (#4706)

**Install Command:**
```bash
bun run powershell:try-beta
```

### 🛡️ FALLBACK: No PSReadLine (Stable but Basic)

If beta version causes issues:

```bash
bun run powershell:try-beta-revert
```

This completely removes PSReadLine for a basic but stable PowerShell experience.

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `bun run powershell:emergency-fix` | Fix profile crashes (already applied) |
| `bun run powershell:try-beta` | Install PSReadLine 2.4.2-beta2 with Cursor fixes |
| `bun run powershell:try-beta-revert` | Remove PSReadLine completely |

## Testing Strategy

1. **Try beta version** for 2-3 days of normal development
2. **Watch for crashes** - any exit code -1073741571 or terminal freezes
3. **If unstable:** Revert to no PSReadLine immediately
4. **If stable:** Keep using beta version

## What's Different in the Beta

The beta specifically addresses terminal integration issues that affect IDEs like Cursor:

- **Fewer cursor queries** = less chance of Cursor terminal protocol conflicts
- **Better buffer handling** = safer interaction with Cursor's terminal hooks
- **Initialization guards** = prevents startup crashes in IDE environments

## Notes

- **Only affects PowerShell console** - doesn't impact Cursor's main functionality
- **Easy to revert** if issues arise
- **Project development continues normally** regardless of PSReadLine choice