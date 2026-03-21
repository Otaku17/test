package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App holds per-session state for the Wails application.
type App struct {
	ctx            context.Context
	projectPath    string
	closeConfirmed bool // set to true once the user confirms close in the unsaved-changes dialog
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.WindowExecJS(a.ctx, "window.__WAILS__ = true;")
	runtime.WindowSetTitle(a.ctx, "Crafting Editor")
}

func (a *App) shutdown(ctx context.Context) {}

// beforeClose blocks the window close event and emits "app:before-close" so
// the frontend can prompt for unsaved changes.
func (a *App) beforeClose(ctx context.Context) bool {
	if a.closeConfirmed {
		return false // allow close
	}
	runtime.EventsEmit(ctx, "app:before-close")
	return true // block — frontend decides
}

// ConfirmClose is called by the frontend after the user resolves the unsaved-
// changes dialog. Pass true to quit, false to cancel.
func (a *App) ConfirmClose(shouldClose bool) {
	if shouldClose {
		a.closeConfirmed = true
		runtime.Quit(a.ctx)
	}
}

// ── Data types returned to the frontend ───────────────────────────────────────

// GameItem represents a Pokémon SDK item (dbSymbol, display name, icon path).
type GameItem struct {
	DbSymbol string `json:"dbSymbol"`
	Name     string `json:"name,omitempty"`
	Icon     string `json:"icon,omitempty"`
	ID       int    `json:"id,omitempty"`
}

// ProjectData is the payload returned by OpenProject / OpenProjectPath.
type ProjectData struct {
	ProjectName string            `json:"projectName"`
	ProjectPath string            `json:"projectPath"`
	ProjectIcon string            `json:"projectIconUrl"` // base64 data URL or ""
	ConfigJSON  string            `json:"configJSON"`     // raw crafting_config.json content
	Items       []GameItem        `json:"items"`
	ItemIcons   map[string]string `json:"itemIcons"` // dbSymbol → base64 data URL
	ItemNames   map[string]string `json:"itemNames"` // dbSymbol → display name (from 100012.csv)
	CsvText     string            `json:"csvText"`   // raw 140000.csv content
	HasCsv      bool              `json:"hasCsv"`
	HasConfig   bool              `json:"hasConfig"`
	Warnings    []string          `json:"warnings"`
}

// ── Project opening ───────────────────────────────────────────────────────────

// OpenProject shows a native directory picker and loads the selected project.
func (a *App) OpenProject() (*ProjectData, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select your Pokémon SDK project folder",
	})
	if err != nil || dir == "" {
		return nil, nil // cancelled
	}
	a.projectPath = dir
	runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(dir))
	a.saveLastProjectPath(dir)
	data, err := a.loadProject(dir)
	if err == nil && data != nil {
		a.saveRecentProject(dir, data.ProjectIcon)
	}
	return data, err
}

// ReopenLastProject reopens the most recently used project without a dialog.
func (a *App) ReopenLastProject() (*ProjectData, error) {
	last := a.loadLastProjectPath()
	if last == "" {
		return nil, nil
	}
	if _, err := os.Stat(last); os.IsNotExist(err) {
		return nil, fmt.Errorf("last project folder not found: %s", last)
	}
	a.projectPath = last
	runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(last))
	return a.loadProject(last)
}

// GetLastProjectPath returns the path of the last opened project (for the UI).
func (a *App) GetLastProjectPath() string {
	return a.loadLastProjectPath()
}

// OpenProjectPath opens a project from a known path (used by the dashboard).
func (a *App) OpenProjectPath(path string) (*ProjectData, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("project folder not found: %s", path)
	}
	a.projectPath = path
	runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(path))
	a.saveLastProjectPath(path)
	data, err := a.loadProject(path)
	if err != nil {
		return nil, err
	}
	icon := ""
	if data != nil {
		icon = data.ProjectIcon
	}
	a.saveRecentProject(path, icon)
	return data, nil
}

// ── Project loading ───────────────────────────────────────────────────────────

// loadProject reads all relevant files from a project directory and returns
// a ProjectData payload ready for the frontend.
func (a *App) loadProject(dir string) (*ProjectData, error) {
	data := &ProjectData{
		ProjectName: filepath.Base(dir),
		ProjectPath: dir,
		ItemIcons:   map[string]string{},
		ItemNames:   map[string]string{},
		Warnings:    []string{},
	}

	// Read project name from the .studio file
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".studio") {
			raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err == nil {
				var studio struct {
					Title string `json:"title"`
				}
				if json.Unmarshal(raw, &studio) == nil && studio.Title != "" {
					data.ProjectName = studio.Title
				}
			}
			break
		}
	}

	// Project icon (graphics/icons/game.*)
	for _, ext := range []string{"png", "PNG", "jpg", "JPG", "jpeg", "JPEG", "gif", "webp"} {
		path := filepath.Join(dir, "graphics", "icons", "game."+ext)
		if raw, err := os.ReadFile(path); err == nil {
			mime := "image/" + strings.ToLower(ext)
			if strings.ToLower(ext) == "jpg" || strings.ToLower(ext) == "jpeg" {
				mime = "image/jpeg"
			}
			data.ProjectIcon = "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(raw)
			break
		}
	}

	// crafting_config.json
	configPath := filepath.Join(dir, "Data", "configs", "crafting_config.json")
	if raw, err := os.ReadFile(configPath); err == nil {
		data.ConfigJSON = string(raw)
		data.HasConfig = true
	} else {
		data.Warnings = append(data.Warnings, "plugin_missing")
	}

	// Items — Data/Studio/items/*.json (one file per item)
	itemsDir := filepath.Join(dir, "Data", "Studio", "items")
	if itemEntries, err := os.ReadDir(itemsDir); err == nil {
		for _, e := range itemEntries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			raw, err := os.ReadFile(filepath.Join(itemsDir, e.Name()))
			if err != nil {
				continue
			}
			// Try single-object format first, then array
			var item GameItem
			if json.Unmarshal(raw, &item) == nil && item.DbSymbol != "" {
				data.Items = append(data.Items, item)
				continue
			}
			var items []GameItem
			if json.Unmarshal(raw, &items) == nil {
				for _, it := range items {
					if it.DbSymbol != "" {
						data.Items = append(data.Items, it)
					}
				}
			}
		}
	} else {
		data.Warnings = append(data.Warnings, "items: "+err.Error())
	}

	// Item icons — graphics/icons/<icon>.png, fallback to return.png
	iconsDir := filepath.Join(dir, "graphics", "icons")
	fallbackURL := ""
	if raw, err := os.ReadFile(filepath.Join(iconsDir, "return.png")); err == nil {
		fallbackURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
	}
	for _, item := range data.Items {
		url := fallbackURL
		if item.Icon != "" {
			if raw, err := os.ReadFile(filepath.Join(iconsDir, item.Icon+".png")); err == nil {
				url = "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
			}
		}
		data.ItemIcons[item.DbSymbol] = url
	}

	// CSV files — try Data/Text/Dialogs first, then Data/Dialogs
	csvDirs := [][]string{
		{"Data", "Text", "Dialogs"},
		{"Data", "Dialogs"},
	}
	for _, parts := range csvDirs {
		csvDir := filepath.Join(append([]string{dir}, parts...)...)

		// 140000.csv — category translations
		csvPath := filepath.Join(csvDir, "140000.csv")
		if raw, err := os.ReadFile(csvPath); err == nil {
			data.CsvText = string(raw)
			data.HasCsv = true
		} else {
			data.Warnings = append(data.Warnings, "csv_missing")
		}

		// 100012.csv — item display names (EN column)
		namesPath := filepath.Join(csvDir, "100012.csv")
		if raw, err := os.ReadFile(namesPath); err == nil {
			lines := strings.Split(string(raw), "\n")
			for _, item := range data.Items {
				if item.ID < 0 {
					continue
				}
				lineIdx := item.ID + 1
				if lineIdx < len(lines) {
					cols := strings.SplitN(lines[lineIdx], ",", 2)
					if len(cols) > 0 {
						name := strings.Trim(strings.TrimSpace(cols[0]), `"`)
						if name != "" {
							data.ItemNames[item.DbSymbol] = name
						}
					}
				}
			}
		}
		break
	}

	return data, nil
}

// ── Quests ────────────────────────────────────────────────────────────────────

// GameQuest holds the fields we need from a quest JSON file.
type GameQuest struct {
	DbSymbol string `json:"dbSymbol"`
	ID       int    `json:"id"`
}

// QuestData is the payload returned by GetQuests.
type QuestData struct {
	Quests       []GameQuest `json:"quests"`
	QuestCsvText string      `json:"questCsvText"`
	HasQuestCsv  bool        `json:"hasQuestCsv"`
}

// GetQuests reads Data/Studio/quests/*.json and Data/Text/Dialogs/100045.csv
// from the currently open project. Called by the frontend after OpenProject.
func (a *App) GetQuests() (*QuestData, error) {
	if a.projectPath == "" {
		return nil, fmt.Errorf("no project open")
	}

	data := &QuestData{}

	// Quests — one JSON file per quest
	questsDir := filepath.Join(a.projectPath, "Data", "Studio", "quests")
	if entries, err := os.ReadDir(questsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			raw, err := os.ReadFile(filepath.Join(questsDir, e.Name()))
			if err != nil {
				continue
			}
			var q GameQuest
			if json.Unmarshal(raw, &q) == nil && q.DbSymbol != "" {
				data.Quests = append(data.Quests, q)
			}
		}
	}

	// 100045.csv — quest name translations (same structure as 140000.csv)
	csvDirs := [][]string{
		{"Data", "Text", "Dialogs"},
		{"Data", "Dialogs"},
	}
	for _, parts := range csvDirs {
		csvPath := filepath.Join(append([]string{a.projectPath}, append(parts, "100045.csv")...)...)
		if raw, err := os.ReadFile(csvPath); err == nil {
			data.QuestCsvText = string(raw)
			data.HasQuestCsv = true
			break
		}
	}

	return data, nil
}

// ── Save ─────────────────────────────────────────────────────────────────────

// SaveConfig writes crafting_config.json to the open project.
func (a *App) SaveConfig(jsonContent string) error {
	if a.projectPath == "" {
		return fmt.Errorf("no project open")
	}
	path := filepath.Join(a.projectPath, "Data", "configs", "crafting_config.json")
	return os.WriteFile(path, []byte(jsonContent), 0644)
}

// SaveCsv writes 140000.csv to the open project.
func (a *App) SaveCsv(content string) error {
	if a.projectPath == "" {
		return fmt.Errorf("no project open")
	}
	for _, parts := range [][]string{{"Data", "Text", "Dialogs"}, {"Data", "Dialogs"}} {
		csvDir := filepath.Join(append([]string{a.projectPath}, parts...)...)
		path := filepath.Join(csvDir, "140000.csv")
		if _, err := os.Stat(path); err == nil {
			return os.WriteFile(path, []byte(content), 0644)
		}
	}
	return fmt.Errorf("140000.csv not found")
}

// ── Recent projects persistence ───────────────────────────────────────────────

func (a *App) lastProjectFile() string {
	dir, _ := os.UserConfigDir()
	return filepath.Join(dir, "crafting-editor", "last_project.txt")
}

func (a *App) saveLastProjectPath(path string) {
	f := a.lastProjectFile()
	os.MkdirAll(filepath.Dir(f), 0755)
	os.WriteFile(f, []byte(path), 0644)
}

func (a *App) loadLastProjectPath() string {
	raw, err := os.ReadFile(a.lastProjectFile())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(raw))
}

// RecentProject holds the data displayed on a dashboard card.
type RecentProject struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Icon     string `json:"icon"`     // base64 data URL or ""
	OpenedAt string `json:"openedAt"` // Unix timestamp (ms) as string
}

func (a *App) recentProjectsFile() string {
	dir, _ := os.UserConfigDir()
	return filepath.Join(dir, "crafting-editor", "recent_projects.json")
}

func (a *App) GetRecentProjects() []RecentProject {
	raw, err := os.ReadFile(a.recentProjectsFile())
	if err != nil {
		return []RecentProject{}
	}
	var projects []RecentProject
	if err := json.Unmarshal(raw, &projects); err != nil {
		return []RecentProject{}
	}
	return projects
}

func (a *App) saveRecentProject(dir string, icon string) {
	projects := a.GetRecentProjects()

	// Remove existing entry for this path
	filtered := projects[:0]
	for _, p := range projects {
		if p.Path != dir {
			filtered = append(filtered, p)
		}
	}

	// Prepend the new entry
	entry := RecentProject{
		Name:     filepath.Base(dir),
		Path:     dir,
		Icon:     icon,
		OpenedAt: fmt.Sprintf("%d", time.Now().UnixMilli()),
	}
	projects = append([]RecentProject{entry}, filtered...)

	// Keep at most 4 recent projects
	if len(projects) > 4 {
		projects = projects[:4]
	}

	data, _ := json.MarshalIndent(projects, "", "  ")
	f := a.recentProjectsFile()
	os.MkdirAll(filepath.Dir(f), 0755)
	os.WriteFile(f, data, 0644)
}

// RemoveRecentProject removes a project from the recent list.
func (a *App) RemoveRecentProject(path string) {
	projects := a.GetRecentProjects()
	filtered := projects[:0]
	for _, p := range projects {
		if p.Path != path {
			filtered = append(filtered, p)
		}
	}
	data, _ := json.MarshalIndent(filtered, "", "  ")
	os.WriteFile(a.recentProjectsFile(), data, 0644)
}

// RedefineRecentProject opens a directory picker to relocate a missing project,
// replaces the old entry in the recent list, and loads the project.
func (a *App) RedefineRecentProject(oldPath string) (*ProjectData, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select new location for this project",
	})
	if err != nil || dir == "" {
		return nil, nil // cancelled
	}

	// Remove the old entry before adding the new path
	projects := a.GetRecentProjects()
	filtered := projects[:0]
	for _, p := range projects {
		if p.Path != oldPath {
			filtered = append(filtered, p)
		}
	}
	if data, err2 := json.MarshalIndent(filtered, "", "  "); err2 == nil {
		os.WriteFile(a.recentProjectsFile(), data, 0644)
	}

	a.projectPath = dir
	runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(dir))
	a.saveLastProjectPath(dir)
	projectData, err := a.loadProject(dir)
	if err == nil && projectData != nil {
		a.saveRecentProject(dir, projectData.ProjectIcon)
	}
	return projectData, err
}

// CheckRecentPaths verifies that each recent project folder still exists.
// Returns the list of paths that no longer exist on disk.
func (a *App) CheckRecentPaths() []string {
	projects := a.GetRecentProjects()
	var invalid []string
	for _, p := range projects {
		if _, err := os.Stat(p.Path); os.IsNotExist(err) {
			invalid = append(invalid, p.Path)
		}
	}
	if invalid == nil {
		return []string{}
	}
	return invalid
}

// ── Auto-update ───────────────────────────────────────────────────────────────

// AppVersion must match the Git release tag (without the "v" prefix).
const AppVersion = "0.1.6"

// GitHubRepo is the "owner/name" used to query the GitHub Releases API.
const GitHubRepo = "Otaku17/test"

// GetVersion returns the current application version.
func (a *App) GetVersion() string { return AppVersion }

// UpdateInfo is returned by CheckUpdate and consumed by the frontend.
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	AssetURL       string `json:"assetURL"`  // direct download URL for this OS
	AssetName      string `json:"assetName"` // filename of the asset
}

// CheckUpdate queries the GitHub Releases API to detect a newer version.
// Returns silently on network errors.
func (a *App) CheckUpdate() (*UpdateInfo, error) {
	info := &UpdateInfo{CurrentVersion: AppVersion, LatestVersion: AppVersion}

	client := &http.Client{Timeout: 10 * 1_000_000_000} // 10 s
	req, err := http.NewRequest("GET", "https://api.github.com/repos/"+GitHubRepo+"/releases/latest", nil)
	if err != nil {
		return info, nil
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "CraftingEditor/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return info, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return info, nil
	}

	var release struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return info, nil
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(AppVersion, "v")
	info.LatestVersion = latest
	info.HasUpdate = latest != current && latest != ""

	if info.HasUpdate {
		info.AssetName, info.AssetURL = pickAssetForCurrentOS(release.Assets)
	}
	return info, nil
}

func pickAssetForCurrentOS(assets []struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}) (string, string) {
	goos := goruntime.GOOS
	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		switch goos {
		case "windows":
			if strings.HasSuffix(name, ".exe") {
				return asset.Name, asset.BrowserDownloadURL
			}
		case "darwin":
			if strings.HasSuffix(name, ".dmg") {
				return asset.Name, asset.BrowserDownloadURL
			}
		case "linux":
			if strings.HasSuffix(name, ".appimage") {
				return asset.Name, asset.BrowserDownloadURL
			}
		}
	}
	if len(assets) > 0 {
		return assets[0].Name, assets[0].BrowserDownloadURL
	}
	return "", ""
}

// DownloadAndInstallUpdate downloads the given asset and launches the installer,
// then quits the application.
func (a *App) DownloadAndInstallUpdate(assetURL string, assetName string) error {
	destPath := filepath.Join(os.TempDir(), assetName)

	client := &http.Client{Timeout: 5 * 60 * 1_000_000_000} // 5 min
	resp, err := client.Get(assetURL)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("cannot create temp file: %w", err)
	}
	_, err = io.Copy(f, resp.Body)
	f.Close()
	if err != nil {
		return fmt.Errorf("write failed: %w", err)
	}

	if err := launchInstaller(destPath); err != nil {
		return fmt.Errorf("launch installer failed: %w", err)
	}
	runtime.Quit(a.ctx)
	return nil
}

// ── OS helpers ────────────────────────────────────────────────────────────────

// GetCurrentOS exposes runtime.GOOS to the frontend.
func (a *App) GetCurrentOS() string { return goruntime.GOOS }

func launchInstaller(path string) error {
	switch goruntime.GOOS {
	case "windows":
		cmd := exec.Command(path)
		cmd.SysProcAttr = getSysProcAttr()
		return cmd.Start()
	case "darwin":
		return exec.Command("open", path).Start()
	case "linux":
		if err := os.Chmod(path, 0755); err != nil {
			return err
		}
		return exec.Command(path).Start()
	}
	return fmt.Errorf("unsupported OS: %s", goruntime.GOOS)
}
