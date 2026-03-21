/**
 * catColors.ts
 * Stores per-category custom hex colors in localStorage.
 * Format: { [catKey]: { bg, text, border } }
 */

export interface CatColorDef {
  base: string; // hex, e.g. "#9b7fe8"
}

const STORAGE_KEY = 'catColors_v2';

function load(): Record<string, CatColorDef> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function save(map: Record<string, CatColorDef>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Derive bg (10% opacity) and border (30% opacity) from a hex color */
export function deriveFromHex(hex: string): { bg: string; text: string; border: string } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    text:   hex,
    bg:     `rgba(${r},${g},${b},0.12)`,
    border: `rgba(${r},${g},${b},0.35)`,
  };
}

const DEFAULTS: Record<string, string> = {
  all:     '#5b8af5',
  ball:    '#4ab8e8',
  medical: '#e86b6b',
  tm:      '#e8a94a',
};
const FALLBACK = '#9b7fe8';

export function getCatColorDef(key: string): CatColorDef {
  const stored = load()[key];
  if (stored) return stored;
  return { base: DEFAULTS[key] ?? FALLBACK };
}

export function getCatColorVars(key: string) {
  return deriveFromHex(getCatColorDef(key).base);
}

export function setCatColor(key: string, base: string) {
  const map = load();
  map[key] = { base };
  save(map);
}

export function renameCatColor(oldKey: string, newKey: string) {
  const map = load();
  if (map[oldKey]) { map[newKey] = map[oldKey]; delete map[oldKey]; save(map); }
}

export function deleteCatColor(key: string) {
  const map = load(); delete map[key]; save(map);
}
