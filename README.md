# Git Groups

[한국어](README.ko.md)

A VS Code extension that lets you organize changed files into custom groups and commit them separately — right from the Source Control tab.

## The Problem

> "I modified 10 files — 3 for login, 4 for bug fixes, 3 for refactoring... Committing all at once makes messy history, but splitting into branches causes conflicts because they're interdependent..."

**Limitations of existing approaches:**
- **Branch separation** — Conflicts when features are interdependent, constant merge/rebase
- **git stash** — Temporary storage, not a classification tool. May conflict on pop
- **Manual git add** — Picking files one by one. Error-prone with many files
- **"Just commit everything"** — Mixed history, hard to track later

## How Git Groups Works

Keep your changed files **in place** and simply **tag them into groups** — like sticky notes.

- Files stay in your working tree — no conflicts
- Stage & commit per group — clean commit history
- No branch switching needed
- Drag & drop to organize

```
10 changed files
  ↓ Organize into groups
🏷 Login feature (3)  → Commit "feat: add login"
🏷 Bug fixes (4)      → Commit "fix: resolve timeout"
🏷 Refactoring (3)    → Commit "refactor: clean up utils"
```

## Install

Search **"Git Groups"** in VS Code Extensions (`Ctrl+Shift+X`)

## Usage

### 1. Create a Group

Open the Source Control tab (`Ctrl+Shift+G`) and find the **GIT GROUPS** section.

- Click `[+]` next to **Changes** → enter group name
- Or `Ctrl+Shift+P` → `Git Groups: Create Group`

### 2. Add Files to a Group

- **Right-click** a file → `Add to Group...` → select group
- Or **drag & drop** files onto a group
- Multi-select and drag supported

### 3. Commit by Group

**Option A: Stage group → Commit**
1. Click `[↑]` on a group in Changes (group moves to Staged Changes)
2. Click `[✓]` on the group in Staged Changes
3. Group name is pre-filled as commit message → edit or press Enter

**Option B: Batch commit multiple groups**
1. Stage multiple groups
2. Click `[✓]` on Staged Changes section
3. Select groups to commit via QuickPick (checkboxes)
4. Each group creates a **separate commit** (group name = commit message)
5. Ungrouped files prompt for a commit message
6. Committed groups are **auto-deleted**

**Option C: Individual file management**
- `[↑]` on a file → Stage
- `[↓]` on a staged file → Unstage
- `[✗]` on a file → Discard changes
- `[📦]` on a file → Stash individual file (restores to original group on pop)

**Stage/Unstage All**
- `[↑]` on Changes section → Stage all
- `[↓]` on Staged Changes section → Unstage all

### 4. Group Management

- **Rename**: Select group + `F2`, or right-click → `Rename Group`
- **Delete**: `[🗑]` button on group, or right-click → `Delete Group`
- **Remove file**: Right-click file in group → `Remove from Group`

### 5. AI Group Name Generation (GitHub Copilot required)

Click `[✨]` on a group to auto-generate a name by analyzing the diff. Works in both Staged Changes and Changes.

Example: `feat: add user authentication`, `fix: resolve login timeout`

> Requires GitHub Copilot to be installed. Shows a message if unavailable.

### 6. Stash

**Stash a group:**
- Click `[📦]` on a group in Changes → stash that group only
- Pop restores the group name and file mapping

**Stash all:**
- Click `[📦]` on Changes section → creates separate stash per group
- Click `[Pop All]` on Stashes section to restore everything

**Stash management:**
- View stash list in Stashes section, expand to see files
- Individual `[Pop]` / `[🗑 Drop]` per stash

### 7. Undo Last Commit

Click `[↩]` in the toolbar to undo the last commit.

- Shows confirmation with commit message
- Runs `git reset --soft HEAD~1`
- Changes move back to **Staged Changes**

### 8. Other

- **Collapse/Expand all**: Toggle button in toolbar
- **Refresh**: `[↻]` button (auto-refreshes on file changes)
- **View diff**: Click any file
- **Clean empty groups**: `[🧹]` button in toolbar

## Layout

```
GIT GROUPS                [↩][🧹][↻][toggle]
├── Staged Changes               [↓][✓]
│   ├── 🏷 login feature [✨][↓][🗑][✓]
│   │   ├── auth.ts          M    [↓]
│   │   └── login.vue        M    [↓]
│   └── config.yaml          A    [↓]
│
── ── ── ── ── ── ──
│
├── Changes                   [↑][📦][+]
│   ├── 🏷 bug fix  [✨][↑][✗][📦][🗑]
│   │   └── utils.ts         M    [↑][✗]
│   ├── readme.md            M    [↑][✗]
│   └── app.py               M    [↑][✗]
│
── ── ── ── ── ── ──
│
├── Stashes                   [Pop All]
│   ├── 📦 refactoring   2 files  [Pop][🗑]
│   │   ├── utils.ts
│   │   └── helper.ts
│   └── 📦 WIP            1 files  [Pop][🗑]
│       └── temp.ts
```

## Features

| Feature | Description |
|---------|-------------|
| Create/Delete/Rename groups | Logically organize files |
| Drag & drop | Move files between groups |
| Group Stage/Unstage | git add/reset per group |
| Stage/Unstage All | Bulk stage or unstage |
| Group Commit | Commit per group (group name = commit message) |
| Batch Commit | QuickPick to select groups → separate commits |
| Group Stash/Pop | Stash per group, pop restores group |
| Stash All / Pop All | Separate stash per group, restore all at once |
| AI Group Name | Copilot analyzes diff and suggests group name |
| Undo Last Commit | git reset --soft HEAD~1 |
| Clean Empty Groups | Delete all groups with 0 files |
| Per-file Stage/Unstage/Discard/Stash | Individual file management |
| Ungrouped display option | Show ungrouped files in a group or directly |
| Group data persistence | Auto-saved to `.vscode/git-groups.json` |
| Auto-refresh | Refreshes on file and settings changes |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitGroups.confirmDeleteGroup` | `true` | Show confirmation when deleting a group |
| `gitGroups.confirmDropStash` | `true` | Show confirmation when dropping a stash |
| `gitGroups.showUngroupedSection` | `false` | Show ungrouped files inside an "Ungrouped" group |

## License

MIT
