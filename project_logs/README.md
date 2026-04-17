# Project Logs — How This Works

Four files. One purpose: **Claude Code never forgets anything across sessions.**

## The Files

| File | What it is | When to update |
|------|-----------|----------------|
| `BLUEPRINT.md` | Vision, tech stack, architecture, principles | Rarely (only on major pivots) |
| `STATE.md` | Current working state + next 3 steps + file inventory | End of every session |
| `CHANGELOG.md` | Date-wise history + mistakes & lessons learned | End of every session (append only) |
| `README.md` | This file — how to use this folder | Rarely |

## How Vinit Uses This with Claude Code

### At the START of every session, paste:
> "Read `project_logs/STATE.md` and `project_logs/BLUEPRINT.md` before we start. Then tell me where we left off and what the next step is."

### At the END of every session, say:
> "Update `project_logs/STATE.md` and `project_logs/CHANGELOG.md` with everything we did today."

### When a mistake happens or you learn something, say:
> "Add this lesson to `CHANGELOG.md`: [describe the mistake and the fix]"

### When Claude proposes a new feature, say:
> "Add this to the roadmap in `STATE.md`"

## Why This System Saves Tokens & Credits

- **No more re-explaining the project** every session → saves ~2000 tokens per session
- **No duplicate work** — INVENTORY section in STATE.md shows what files already exist
- **No repeating past mistakes** — CHANGELOG stores lessons
- **New threads pick up instantly** — 5KB read at start vs 50KB of context rebuilding

## Rules for Claude Code

1. NEVER write code without reading `STATE.md` first (check if the file already exists)
2. NEVER make up facts — check these logs or read actual files
3. ALWAYS update STATE.md + CHANGELOG.md at end of session (even if user forgets to ask)
4. NEVER delete old CHANGELOG entries — append only
5. Keep STATE.md under 250 lines — move old info to CHANGELOG if needed
