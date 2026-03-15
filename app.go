package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct — une instance par session
type App struct {
	ctx         context.Context
	projectPath string // chemin du dossier projet en cours
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Injecter __WAILS__ pour que le frontend détecte le mode desktop
	runtime.WindowExecJS(a.ctx, "window.__WAILS__ = true;")
	// Restaurer le dernier projet ouvert
	last := a.loadLastProjectPath()
	if last != "" {
		runtime.WindowSetTitle(a.ctx, "Crafting Editor — "+filepath.Base(last))
	}
}

func (a *App) shutdown(ctx context.Context) {}

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
	ItemIcons   map[string]string `json:"itemIcons"`   // dbSymbol → base64 data URL
	ItemNames   map[string]string `json:"itemNames"`   // dbSymbol → display name
	CsvText     string            `json:"csvText"`     // contenu brut du CSV 140000
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

	return a.loadProject(dir)
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
		path := filepath.Join(dir, "project_icon."+ext)
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

// ─── Version & Auto-update ────────────────────────────────────────────────────

// AppVersion — incrémenter à chaque release
const AppVersion = "0.1.0"

// GetVersion retourne la version actuelle
func (a *App) GetVersion() string {
	return AppVersion
}

// UpdateInfo résultat du check de MAJ
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	UpdateURL      string `json:"updateURL"`
}

// CheckUpdate interroge /version.json sur la PWA déployée.
// La PWA doit exposer un fichier public/version.json : { "version": "x.y.z" }
func (a *App) CheckUpdate(pwaBaseURL string) (*UpdateInfo, error) {
	info := &UpdateInfo{
		CurrentVersion: AppVersion,
		LatestVersion:  AppVersion,
		HasUpdate:      false,
		UpdateURL:      pwaBaseURL,
	}

	client := &http.Client{Timeout: 5 * 1_000_000_000} // 5s
	resp, err := client.Get(pwaBaseURL + "/version.json")
	if err != nil {
		return info, nil // silencieux si pas de réseau
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return info, nil
	}

	var remote struct {
		Version string `json:"version"`
	}
	if json.Unmarshal(body, &remote) == nil && remote.Version != "" {
		info.LatestVersion = remote.Version
		info.HasUpdate = remote.Version != AppVersion
	}
	return info, nil
}
