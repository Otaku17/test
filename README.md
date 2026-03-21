# Crafting Editor

A desktop editor for the **Pokémon SDK** crafting system, built with [Wails](https://wails.io/) (Go + React/TypeScript).

It lets you create, edit, and delete crafting recipes, manage categories, configure unlock conditions, and preview the generated JSON — all without touching a single JSON file by hand.

---

## Features

- **Recipe editor** — ingredients (up to 4), result item, quantity, category
- **Unlock conditions** — visual tree editor supporting `manual`, `switch`, `variable`, `recipe`, `quest`, and compound operators (`AND` / `OR` / `NOT`)
- **Category manager** — add/delete categories, edit translations for 7 languages directly from the embedded CSV
- **JSON viewer** — syntax-highlighted preview of `crafting_config.json` with live line count and copy button
- **Quest support** — loads `Data/Studio/quests/*.json` and resolves display names from `100045.csv`
- **Auto-update** — checks GitHub Releases on startup and installs updates in one click
- **Recent projects** — dashboard with the last 4 projects, missing-folder detection and relocation
- **Dark / light theme**

---

## Project structure

```
.
├── app.go              # Go backend — file I/O, Wails bindings
├── main.go             # Wails entry point
├── sysproc_*.go        # OS-specific process attributes
└── frontend/
    └── src/
        ├── App.tsx                     # Root component, routing
        ├── store/index.ts              # Zustand global state
        ├── types/index.ts              # Shared TypeScript types
        ├── utils/
        │   ├── fileSystem.ts           # Go bridge + CSV/JSON parsing
        │   ├── validation.ts           # Recipe validation
        │   ├── i18n.ts                 # EN / FR translations
        │   └── appMode.ts             # Desktop build constants
        └── components/
            ├── Dashboard/              # Project picker
            ├── NavRail/                # Left navigation
            ├── Sidebar/                # Recipe list
            ├── RecipeEditor/           # Main recipe form + condition tree
            ├── CategoryManager/        # Category editor + CSV translations
            ├── JsonViewer/             # Syntax-highlighted JSON preview
            ├── Modal/                  # New/Delete/Unsaved/MissingFiles dialogs
            ├── Toast/                  # Notification system
            └── layout/                 # Badge, Button, Form, UpdatePrompt
```

---

## Data paths (Pokémon SDK project)

| File | Purpose |
|------|---------|
| `Data/configs/crafting_config.json` | Main config file (read + written) |
| `Data/Studio/items/*.json` | Item definitions (read-only) |
| `Data/Studio/quests/*.json` | Quest definitions (read-only) |
| `Data/Text/Dialogs/140000.csv` | Category name translations (read + written) |
| `Data/Text/Dialogs/100012.csv` | Item display names (read-only) |
| `Data/Text/Dialogs/100045.csv` | Quest display names (read-only) |
| `graphics/icons/<icon>.png` | Item icons (read-only) |

> Fallback path `Data/Dialogs/` is also checked for all CSV files.

---

## Unlock condition types

| Type | Description |
|------|-------------|
| `manual` | Always locked / always unlocked |
| `switch` | Game switch by ID |
| `variable` | Game variable ID ≥ value |
| `recipe` | Another recipe must be unlocked first |
| `quest` | A quest must be completed |
| `operator (AND/OR/NOT)` | Combine any of the above |

---

## Go API surface (Wails bindings)

| Method | Description |
|--------|-------------|
| `OpenProject()` | Open native directory picker and load project |
| `OpenProjectPath(path)` | Load project from a known path |
| `ReopenLastProject()` | Reload the last opened project |
| `GetQuests()` | Load quests + quest CSV separately after project open |
| `SaveConfig(json)` | Write `crafting_config.json` |
| `SaveCsv(content)` | Write `140000.csv` |
| `GetRecentProjects()` | List recent projects |
| `CheckRecentPaths()` | Return paths that no longer exist |
| `RemoveRecentProject(path)` | Remove an entry from recents |
| `RedefineRecentProject(path)` | Relocate a missing project |
| `CheckUpdate()` | Query GitHub Releases API |
| `DownloadAndInstallUpdate(url, name)` | Download + launch installer |
| `ConfirmClose(bool)` | Respond to the before-close event |
| `GetCurrentOS()` | Return `windows`, `darwin`, or `linux` |
| `GetVersion()` | Return the current app version |

---

## Development

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run in development mode (hot reload)
wails dev

# Build for production
wails build
```

Requirements: Go 1.21+, Node 18+, Wails v2.

---

## Configuration persistence

User preferences are stored in the OS config directory:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\crafting-editor\` |
| macOS | `~/Library/Application Support/crafting-editor/` |
| Linux | `~/.config/crafting-editor/` |

Files: `last_project.txt`, `recent_projects.json`.
