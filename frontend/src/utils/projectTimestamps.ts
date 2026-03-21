/**
 * projectTimestamps.ts
 * Tracks per-project "last activity" timestamps in localStorage.
 * Keyed by project path. Updated on open and on save.
 * Deleted when the project is removed from recents.
 */

const KEY = 'projectTimestamps';

function load(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function save(map: Record<string, number>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function touchProject(path: string) {
  const map = load();
  map[path] = Date.now();
  save(map);
}

export function removeProject(path: string) {
  const map = load();
  delete map[path];
  save(map);
}

export function getProjectTimestamp(path: string): number | null {
  return load()[path] ?? null;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
}
