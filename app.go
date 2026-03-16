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

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct — une instance par session
type App struct {
	ctx            context.Context
	projectPath    string
	closeConfirmed bool // true = l'utilisateur a confirmé la fermeture
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.WindowExecJS(a.ctx, "window.__WAILS__ = true;")
	last := a.loadLastProjectPath()
	if last != "" {
		runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(last))
	}
}

func (a *App) shutdown(ctx context.Context) {}

// beforeClose — si déjà confirmé, autoriser ; sinon émettre l'event et bloquer
func (a *App) beforeClose(ctx context.Context) bool {
	if a.closeConfirmed {
		return false // autoriser la fermeture
	}
	runtime.EventsEmit(ctx, "app:before-close")
	return true // bloquer — le frontend va décider
}

// ConfirmClose — appelé par le frontend : true = fermer, false = annuler
func (a *App) ConfirmClose(shouldClose bool) {
	if shouldClose {
		a.closeConfirmed = true
		runtime.Quit(a.ctx)
	}
}

// ─── Types retournés au frontend ─────────────────────────────────────────────

type GameItem struct {
	DbSymbol string `json:"dbSymbol"`
	Name     string `json:"name,omitempty"`
	Icon     string `json:"icon,omitempty"`
	ID       int    `json:"id,omitempty"`
}

type ProjectData struct {
	ProjectName string            `json:"projectName"`
	ProjectIcon string            `json:"projectIconUrl"` // base64 data URL ou ""
	ConfigJSON  string            `json:"configJSON"`     // contenu brut du JSON
	Items       []GameItem        `json:"items"`
	ItemIcons   map[string]string `json:"itemIcons"` // dbSymbol → base64 data URL
	ItemNames   map[string]string `json:"itemNames"` // dbSymbol → display name
	CsvText     string            `json:"csvText"`   // contenu brut du CSV 140000
	HasCsv      bool              `json:"hasCsv"`
	HasConfig   bool              `json:"hasConfig"`
	Warnings    []string          `json:"warnings"`
}

// ─── OpenProject — dialogue natif + lecture complète du dossier ──────────────

func (a *App) OpenProject() (*ProjectData, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select your Pokémon SDK project folder",
	})
	if err != nil || dir == "" {
		return nil, nil // annulé
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

// ReopenLastProject — réouvre le dernier projet sans dialogue
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

// GetLastProjectPath — retourne le chemin du dernier projet (pour l'afficher dans l'UI)
func (a *App) GetLastProjectPath() string {
	return a.loadLastProjectPath()
}

// ─── loadProject — lecture complète du dossier projet ────────────────────────

func (a *App) loadProject(dir string) (*ProjectData, error) {
	data := &ProjectData{
		ProjectName: filepath.Base(dir),
		ItemIcons:   map[string]string{},
		ItemNames:   map[string]string{},
		Warnings:    []string{},
	}

	// .studio → nom du projet
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

	// project_icon
	for _, ext := range []string{"png", "PNG", "jpg", "JPG", "jpeg", "JPEG", "gif", "webp"} {
		path := filepath.Join(dir, "graphics", "icons", "game."+ext)
		if raw, err := os.ReadFile(path); err == nil {
			mime := "image/" + strings.ToLower(ext)
			if ext == "jpg" || ext == "JPG" || ext == "JPEG" || ext == "jpeg" {
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
		// Vérifier si Data/configs/ existe (plugin non installé)
		configsDir := filepath.Join(dir, "Data", "configs")
		if _, err2 := os.Stat(configsDir); err2 == nil {
			data.Warnings = append(data.Warnings, "plugin_missing")
		} else {
			data.Warnings = append(data.Warnings, "plugin_missing")
		}
	}

	// Items JSON
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
			// Essayer objet unique
			var item GameItem
			if json.Unmarshal(raw, &item) == nil && item.DbSymbol != "" {
				data.Items = append(data.Items, item)
				continue
			}
			// Essayer tableau
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

	// Item icons
	iconsDir := filepath.Join(dir, "graphics", "icons")
	fallbackURL := ""
	if raw, err := os.ReadFile(filepath.Join(iconsDir, "return.png")); err == nil {
		fallbackURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
	}
	for _, item := range data.Items {
		iconFile := item.Icon + ".png"
		if item.Icon == "" {
			iconFile = ""
		}
		url := fallbackURL
		if iconFile != "" {
			if raw, err := os.ReadFile(filepath.Join(iconsDir, iconFile)); err == nil {
				url = "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
			}
		}
		data.ItemIcons[item.DbSymbol] = url
	}

	// CSV 140000 — item names from 100012.csv
	csvPaths := [][]string{
		{"Data", "Text", "Dialogs"},
		{"Data", "Dialogs"},
	}
	for _, parts := range csvPaths {
		csvDir := filepath.Join(append([]string{dir}, parts...)...)
		csvPath := filepath.Join(csvDir, "140000.csv")
		if raw, err := os.ReadFile(csvPath); err == nil {
			data.CsvText = string(raw)
			data.HasCsv = true
		} else {
			data.Warnings = append(data.Warnings, "csv_missing")
		}

		// Item names from 100012.csv
		namesPath := filepath.Join(csvDir, "100012.csv")
		if raw, err := os.ReadFile(namesPath); err == nil {
			lines := strings.Split(string(raw), "\n")
			for _, item := range data.Items {
				id := item.ID
				if id < 0 {
					continue
				}
				lineIdx := id + 1
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

// ─── Save ─────────────────────────────────────────────────────────────────────

// SaveConfig — écrit crafting_config.json dans le projet ouvert
func (a *App) SaveConfig(jsonContent string) error {
	if a.projectPath == "" {
		return fmt.Errorf("no project open")
	}
	path := filepath.Join(a.projectPath, "Data", "configs", "crafting_config.json")
	return os.WriteFile(path, []byte(jsonContent), 0644)
}

// SaveCsv — écrit 140000.csv
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

// ─── Persistance dernier projet ───────────────────────────────────────────────

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

// ─── Version & Auto-update ────────────────────────────────────────────────────

// AppVersion — incrémenter à chaque release (doit correspondre au tag Git sans "v")
const AppVersion = "0.1.4"

// GitHub repo owner/name pour les releases
const GitHubRepo = "Otaku17/crafting-editor"

// GetVersion retourne la version actuelle
func (a *App) GetVersion() string {
	return AppVersion
}

// UpdateInfo résultat du check de MAJ
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	AssetURL       string `json:"assetURL"`  // URL directe de l'asset pour cet OS
	AssetName      string `json:"assetName"` // Nom du fichier à télécharger
}

// CheckUpdate interroge l'API GitHub Releases pour détecter une nouvelle version.
// Retourne l'URL de l'asset correspondant à l'OS courant.
func (a *App) CheckUpdate() (*UpdateInfo, error) {
	info := &UpdateInfo{
		CurrentVersion: AppVersion,
		LatestVersion:  AppVersion,
		HasUpdate:      false,
	}

	client := &http.Client{Timeout: 10 * 1_000_000_000} // 10s
	apiURL := "https://api.github.com/repos/" + GitHubRepo + "/releases/latest"

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return info, nil
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "CraftingEditor/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil {
		return info, nil // silencieux si pas de réseau
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return info, nil
	}

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

	// Normaliser la version (enlever le "v" préfixe)
	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersion := strings.TrimPrefix(AppVersion, "v")

	info.LatestVersion = latestVersion
	info.HasUpdate = latestVersion != currentVersion && latestVersion != ""

	if info.HasUpdate {
		// Choisir l'asset selon l'OS courant
		assetName, assetURL := pickAssetForCurrentOS(release.Assets)
		info.AssetName = assetName
		info.AssetURL = assetURL
	}

	return info, nil
}

// pickAssetForCurrentOS sélectionne le bon asset selon runtime.GOOS
func pickAssetForCurrentOS(assets []struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}) (string, string) {
	goos := getRuntimeOS()
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
	// Fallback : premier asset disponible
	if len(assets) > 0 {
		return assets[0].Name, assets[0].BrowserDownloadURL
	}
	return "", ""
}

// DownloadAndInstallUpdate télécharge l'asset et lance l'installation,
// puis quitte l'application.
func (a *App) DownloadAndInstallUpdate(assetURL string, assetName string) error {
	// Dossier temporaire
	tmpDir := os.TempDir()
	destPath := filepath.Join(tmpDir, assetName)

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

	// Lancer l'installation selon l'OS
	if err := launchInstaller(destPath); err != nil {
		return fmt.Errorf("launch installer failed: %w", err)
	}

	// Quitter l'app pour laisser l'installer prendre la main
	runtime.Quit(a.ctx)
	return nil
}

// ─── Projets récents ──────────────────────────────────────────────────────────

type RecentProject struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Icon     string `json:"icon"`     // base64 data URL ou ""
	OpenedAt string `json:"openedAt"` // ISO timestamp
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
	name := filepath.Base(dir)

	// Supprimer si déjà présent
	filtered := projects[:0]
	for _, p := range projects {
		if p.Path != dir {
			filtered = append(filtered, p)
		}
	}

	// Ajouter en tête
	entry := RecentProject{
		Name:     name,
		Path:     dir,
		Icon:     icon,
		OpenedAt: fmt.Sprintf("%d", os.Getpid()), // approximation — on utilisera le vrai timestamp en JS
	}
	projects = append([]RecentProject{entry}, filtered...)

	// Garder max 4
	if len(projects) > 4 {
		projects = projects[:4]
	}

	data, _ := json.MarshalIndent(projects, "", "  ")
	f := a.recentProjectsFile()
	os.MkdirAll(filepath.Dir(f), 0755)
	os.WriteFile(f, data, 0644)
}

// OpenProjectPath — ouvre un projet depuis un chemin connu (dashboard)
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

// RemoveRecentProject — supprime un projet des récents
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

// SaveRecentAfterOpen — appelé par le frontend après openProject() pour sauvegarder l'icône
func (a *App) SaveRecentAfterOpen(icon string) {
	if a.projectPath != "" {
		a.saveRecentProject(a.projectPath, icon)
	}
}

// ─── Helpers OS ───────────────────────────────────────────────────────────────

// getRuntimeOS retourne "windows", "darwin" ou "linux"
func getRuntimeOS() string {
	return goruntime.GOOS
}

// GetCurrentOS expose l'OS courant au frontend
func (a *App) GetCurrentOS() string {
	return goruntime.GOOS
}

// launchInstaller ouvre l'installeur selon l'OS
func launchInstaller(path string) error {
	switch goruntime.GOOS {
	case "windows":
		// Lancer l'installeur .exe directement
		cmd := exec.Command(path)
		cmd.SysProcAttr = getSysProcAttr()
		return cmd.Start()

	case "darwin":
		// Ouvrir le .dmg avec Finder/hdiutil
		cmd := exec.Command("open", path)
		return cmd.Start()

	case "linux":
		// Rendre l'AppImage exécutable et le lancer
		if err := os.Chmod(path, 0755); err != nil {
			return err
		}
		cmd := exec.Command(path)
		return cmd.Start()
	}
	return fmt.Errorf("unsupported OS: %s", goruntime.GOOS)
}
