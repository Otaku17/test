/**
 * fileSystem.ts
 *
 * Filesystem layer for the Wails desktop build.
 * All Go bindings are called through window['go']['main']['App'],
 * injected by the Wails runtime at startup.
 */

import type { CraftingConfig, GameItem, GameQuest } from '../types';

// ── Go bridge ────────────────────────────────────────────────────────────────

function goCall(method: string, ...args: unknown[]): Promise<any> {
  const fn = (window as any)?.go?.main?.App?.[method];
  if (typeof fn !== 'function') {
    return Promise.reject(new Error(`Wails binding not ready: App.${method}`));
  }
  return fn(...args);
}

// ── Raw types returned by Go ─────────────────────────────────────────────────

interface WailsProjectData {
  projectPath:    string;
  projectName:    string;
  projectIconUrl: string;
  configJSON:     string;
  items:          GameItem[];
  itemIcons:      Record<string, string>;
  itemNames:      Record<string, string>;
  csvText:        string;
  hasCsv:         boolean;
  hasConfig:      boolean;
  warnings:       string[];
}

/** Returned by Go App.GetQuests() — loaded separately after OpenProject. */
interface WailsQuestData {
  quests:       GameQuest[];
  questCsvText: string;
  hasQuestCsv:  boolean;
}

// ── Exported types ───────────────────────────────────────────────────────────

export interface ProjectFiles {
  projectPath:    string;
  projectName:    string;
  projectIconUrl: string | null;
  config:         CraftingConfig;
  configHandle:   null;
  items:          GameItem[];
  itemIcons:      Record<string, string>;
  itemNames:      Record<string, string>;
  csvHandle:      null;
  csvTexts:       Record<number, string>;
  csvLines:       string[];
  warnings:       string[];
}

export interface QuestFiles {
  quests:     GameQuest[];
  questNames: Record<string, string>;
}

// ── Project loading ───────────────────────────────────────────────────────────

/** Opens a native directory picker and loads the selected project. */
export async function loadProjectFiles(): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('OpenProject');
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}

/** Reopens the last project without a dialog. */
export async function reopenLastProject(): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('ReopenLastProject');
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}

/** Opens a project from a known path (used by the dashboard). */
export async function openProjectByPath(path: string): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('OpenProjectPath', path);
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}

/** Parses a raw WailsProjectData payload already returned by Go (e.g. RedefineRecentProject). */
export function parseRawProjectData(raw: WailsProjectData): ProjectFiles | null {
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}


/**
 * Loads quest data separately after the project is open.
 * Calls Go App.GetQuests() which reads Data/Studio/quests/*.json
 * and Data/Text/Dialogs/100045.csv from the already-open project.
 * Fails silently if the method is not yet implemented on the Go side.
 */
export async function loadQuestFiles(): Promise<QuestFiles> {
  try {
    const raw: WailsQuestData = await goCall('GetQuests');
    if (!raw) return { quests: [], questNames: {} };
    return parseQuestData(raw);
  } catch {
    return { quests: [], questNames: {} };
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

export async function writeJsonToHandle(_handle: null, obj: unknown): Promise<void> {
  await goCall('SaveConfig', JSON.stringify(obj, null, 2));
}

export async function writeCsvToHandle(_handle: null, lines: string[]): Promise<void> {
  await goCall('SaveCsv', lines.join('\n'));
}

// ── CSV utilities ─────────────────────────────────────────────────────────────

/**
 * Parses raw CSV text into indexed lines and a line-index → text map.
 * Strips surrounding quotes from each cell.
 */
export function parseCsvText(text: string): { texts: Record<number, string>; lines: string[] } {
  const lines = text.split('\n');
  const texts: Record<number, string> = {};
  lines.forEach((line, i) => {
    const c = line.trim().replace(/^"|"$/g, '');
    if (c) texts[i] = c;
  });
  return { texts, lines };
}

// ── Internal parsers ──────────────────────────────────────────────────────────

function parseCsvLineRaw(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseQuestData(raw: WailsQuestData): QuestFiles {
  const quests: GameQuest[] = raw.quests ?? [];
  const questNames: Record<string, string> = {};

  if (raw.hasQuestCsv && raw.questCsvText) {
    const lines = raw.questCsvText.split('\n');
    for (const q of quests) {
      // CSV is offset by 1: line at index (id + 1) holds the quest name
      const line = lines[q.id + 1] ?? '';
      const cols = parseCsvLineRaw(line);
      const name = cols[0]?.trim().replace(/^"|"$/g, '');
      questNames[q.dbSymbol] = name || q.dbSymbol;
    }
  } else {
    // No CSV available — fall back to dbSymbol
    for (const q of quests) questNames[q.dbSymbol] = q.dbSymbol;
  }

  return { quests, questNames };
}

function parseWailsData(raw: WailsProjectData): ProjectFiles {
  let config: CraftingConfig = { categories: [], data: {} };
  if (raw.configJSON) {
    try {
      const parsed = JSON.parse(raw.configJSON);
      config = { categories: parsed.categories ?? [], data: parsed.data ?? {} };
    } catch (e) {
      console.error('[fileSystem] config JSON parse error:', e);
    }
  }

  let csvTexts: Record<number, string> = {};
  let csvLines: string[] = [];
  if (raw.hasCsv && raw.csvText) {
    const parsed = parseCsvText(raw.csvText);
    csvTexts = parsed.texts;
    csvLines = parsed.lines;
  }

  return {
    projectPath:    raw.projectPath ?? '',
    projectName:    raw.projectName,
    projectIconUrl: raw.projectIconUrl || null,
    config,
    configHandle:   null,
    items:          raw.items ?? [],
    itemIcons:      raw.itemIcons ?? {},
    itemNames:      raw.itemNames ?? {},
    csvHandle:      null,
    csvTexts,
    csvLines,
    warnings:       raw.warnings ?? [],
  };
}
