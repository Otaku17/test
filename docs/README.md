# Crafting Editor

A desktop editor for Pokémon SDK crafting recipes. Edit `crafting_config.json` with a visual interface.

Built with [Wails](https://wails.io) (Go + React).

## Download

Head to the [Releases page](../../releases) and download the version for your OS.

## First launch warnings

This app is not signed with a paid certificate. Your OS will show a security warning the first time — this is normal for open-source tools.

### Windows — "Windows protected your PC"

Click **More info** → **Run anyway**. Only needed once.

### macOS — "app is damaged and can't be opened"
V
Open Terminal and run:
```bash
xattr -cr /Applications/CraftingEditor.app
```
Or: right-click the `.app` → **Open** → **Open** in the dialog.

## Development

**Prerequisites:** Go 1.21+, Node 18+, [Wails v2](https://wails.io/docs/gettingstarted/installation)

```bash
# Install Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Install frontend deps
cd frontend && npm install && cd ..

# Dev mode (hot reload)
wails dev

# Build for current platform
wails build
```

## Release a new version

```bash
git tag v0.2.0
git push --tags
```

GitHub Actions will automatically build for Windows, macOS and Linux and create a GitHub Release.

## Project structure

```
crafting-editor/
├── main.go           ← Wails entry point
├── app.go            ← Go bindings (OpenProject, SaveConfig...)
├── build/            ← App icons (Windows .ico, macOS .icns)
├── frontend/         ← React frontend
│   └── src/
│       ├── store/    ← Zustand state
│       ├── utils/    ← fileSystem (Go calls), appMode, i18n
│       └── components/
├── docs/             ← GitHub Pages landing page
└── .github/workflows/
    ├── release.yml   ← Build & publish on git tag
    └── pages.yml     ← Deploy landing page
```
