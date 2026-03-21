# Crafting Editor

Un éditeur de bureau pour le système de craft de **Pokémon SDK**, construit avec [Wails](https://wails.io/) (Go + React/TypeScript).

Il permet de créer, modifier et supprimer des recettes de craft, de gérer les catégories, de configurer des conditions de déverrouillage et de prévisualiser le JSON généré — sans jamais toucher un fichier JSON à la main.

---

## Fonctionnalités

- **Éditeur de recettes** — ingrédients (jusqu'à 4), item résultat, quantité, catégorie
- **Conditions de déverrouillage** — éditeur visuel en arbre supportant `manual`, `switch`, `variable`, `recipe`, `quest` et les opérateurs composés (`ET` / `OU` / `NON`)
- **Gestionnaire de catégories** — ajout/suppression de catégories, édition des traductions dans 7 langues directement depuis le CSV embarqué
- **Visionneuse JSON** — aperçu syntaxiquement coloré de `crafting_config.json` avec compteur de lignes et bouton copier
- **Support des quêtes** — charge `Data/Studio/quests/*.json` et résout les noms d'affichage depuis `100045.csv`
- **Mise à jour automatique** — vérifie les releases GitHub au démarrage et installe en un clic
- **Projets récents** — tableau de bord avec les 4 derniers projets, détection et relocalisation des dossiers manquants
- **Thème sombre / clair**

---

## Structure du projet

```
.
├── app.go              # Backend Go — I/O fichiers, bindings Wails
├── main.go             # Point d'entrée Wails
├── sysproc_*.go        # Attributs de processus spécifiques à l'OS
└── frontend/
    └── src/
        ├── App.tsx                     # Composant racine, routage
        ├── store/index.ts              # État global Zustand
        ├── types/index.ts              # Types TypeScript partagés
        ├── utils/
        │   ├── fileSystem.ts           # Pont Go + parsing CSV/JSON
        │   ├── validation.ts           # Validation des recettes
        │   ├── i18n.ts                 # Traductions EN / FR
        │   └── appMode.ts             # Constantes du build desktop
        └── components/
            ├── Dashboard/              # Sélecteur de projet
            ├── NavRail/                # Navigation gauche
            ├── Sidebar/                # Liste des recettes
            ├── RecipeEditor/           # Formulaire recette + arbre de conditions
            ├── CategoryManager/        # Éditeur catégories + traductions CSV
            ├── JsonViewer/             # Aperçu JSON coloré
            ├── Modal/                  # Dialogues Nouvelle/Suppression/Modifications/Fichiers manquants
            ├── Toast/                  # Système de notifications
            └── layout/                 # Badge, Button, Form, UpdatePrompt
```

---

## Chemins de données (projet Pokémon SDK)

| Fichier | Rôle |
|---------|------|
| `Data/configs/crafting_config.json` | Fichier de config principal (lecture + écriture) |
| `Data/Studio/items/*.json` | Définitions des items (lecture seule) |
| `Data/Studio/quests/*.json` | Définitions des quêtes (lecture seule) |
| `Data/Text/Dialogs/140000.csv` | Traductions des noms de catégories (lecture + écriture) |
| `Data/Text/Dialogs/100012.csv` | Noms d'affichage des items (lecture seule) |
| `Data/Text/Dialogs/100045.csv` | Noms d'affichage des quêtes (lecture seule) |
| `graphics/icons/<icon>.png` | Icônes des items (lecture seule) |

> Le chemin de secours `Data/Dialogs/` est également vérifié pour tous les CSV.

---

## Types de conditions de déverrouillage

| Type | Description |
|------|-------------|
| `manual` | Toujours verrouillé / toujours déverrouillé |
| `switch` | Interrupteur de jeu par ID |
| `variable` | Variable de jeu ID ≥ valeur |
| `recipe` | Une autre recette doit être déverrouillée en premier |
| `quest` | Une quête doit être terminée |
| `operator (ET/OU/NON)` | Combinaison de n'importe lequel des types ci-dessus |

---

## Surface API Go (bindings Wails)

| Méthode | Description |
|---------|-------------|
| `OpenProject()` | Ouvre le sélecteur de dossier natif et charge le projet |
| `OpenProjectPath(path)` | Charge un projet depuis un chemin connu |
| `ReopenLastProject()` | Recharge le dernier projet ouvert |
| `GetQuests()` | Charge les quêtes + CSV des quêtes séparément après l'ouverture |
| `SaveConfig(json)` | Écrit `crafting_config.json` |
| `SaveCsv(content)` | Écrit `140000.csv` |
| `GetRecentProjects()` | Liste les projets récents |
| `CheckRecentPaths()` | Retourne les chemins qui n'existent plus |
| `RemoveRecentProject(path)` | Supprime une entrée des récents |
| `RedefineRecentProject(path)` | Relocalise un projet manquant |
| `CheckUpdate()` | Interroge l'API GitHub Releases |
| `DownloadAndInstallUpdate(url, name)` | Télécharge et lance l'installeur |
| `ConfirmClose(bool)` | Répond à l'événement before-close |
| `GetCurrentOS()` | Retourne `windows`, `darwin` ou `linux` |
| `GetVersion()` | Retourne la version actuelle de l'application |

---

## Développement

```bash
# Installer le CLI Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Lancer en mode développement (rechargement à chaud)
wails dev

# Build de production
wails build
```

Prérequis : Go 1.21+, Node 18+, Wails v2.

---

## Persistance de la configuration

Les préférences utilisateur sont stockées dans le répertoire de configuration de l'OS :

| Plateforme | Chemin |
|------------|--------|
| Windows | `%APPDATA%\crafting-editor\` |
| macOS | `~/Library/Application Support/crafting-editor/` |
| Linux | `~/.config/crafting-editor/` |

Fichiers : `last_project.txt`, `recent_projects.json`.
