/**
 * fileSystem.ts
 * Couche filesystem pour Wails.
 * Utilise window['go']['main']['App'] injecté par le runtime Wails
 * (évite les problèmes de chemins d'import avec wailsjs/).
 */

import type { CraftingConfig, GameItem } from '../types';

// Helpers d'appel Go — Wails injecte window['go'] au démarrage
function goCall(method: string, ...args: unknown[]): Promise<any> {
  const fn = (window as any)?.go?.main?.App?.[method];
  if (typeof fn !== 'function') {
    return Promise.reject(new Error(`Wails binding not ready: App.${method}`));
  }
  return fn(...args);
}

interface WailsProjectData {
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

export interface ProjectFiles {
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

export async function loadProjectFiles(): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('OpenProject');
  console.log('[desktop] OpenProject raw:', raw);
  // Wails retourne {} quand Go retourne nil — vérifier projectName
  if (!raw || !raw.projectName) {
    console.log('[desktop] OpenProject: annulé ou vide');
    return null;
  }
  return parseWailsData(raw);
}

export async function reopenLastProject(): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('ReopenLastProject');
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}

export async function openProjectByPath(path: string): Promise<ProjectFiles | null> {
  const raw: WailsProjectData = await goCall('OpenProjectPath', path);
  if (!raw || !raw.projectName) return null;
  return parseWailsData(raw);
}

export async function getLastProjectPath(): Promise<string> {
  return goCall('GetLastProjectPath');
}

function parseWailsData(raw: WailsProjectData): ProjectFiles {
  console.log('[desktop] parseWailsData:', raw.projectName, '— items:', raw.items?.length, '— hasConfig:', raw.hasConfig);

  let config: CraftingConfig = { categories: [], data: {} };
  if (raw.configJSON) {
    try {
      const parsed = JSON.parse(raw.configJSON);
      config = { categories: parsed.categories ?? [], data: parsed.data ?? {} };
      console.log('[desktop] config parsed — recipes:', Object.keys(config.data).length);
    } catch (e) {
      console.error('[desktop] config JSON parse error:', e);
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

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function writeJsonToHandle(_handle: null, obj: unknown): Promise<void> {
  await goCall('SaveConfig', JSON.stringify(obj, null, 2));
}

export async function writeCsvToHandle(_handle: null, lines: string[]): Promise<void> {
  await goCall('SaveCsv', lines.join('\n'));
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

export function parseCsvText(text: string): { texts: Record<number, string>; lines: string[] } {
  const lines = text.split('\n');
  const texts: Record<number, string> = {};
  lines.forEach((line, i) => {
    const c = line.trim().replace(/^"|"$/g, '');
    if (c) texts[i] = c;
  });
  return { texts, lines };
}

export function getCsvText(texts: Record<number, string>, id: number): string {
  return texts[id + 1] !== undefined ? texts[id + 1] : `[${id}]`;
}

export const hasFileSystemAPI = () => true;
