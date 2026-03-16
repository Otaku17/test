/**
 * store/index.ts
 * Store Zustand pour la version Wails.
 * Différences vs store/index.ts :
 *  - openProject() appelle loadProjectFiles() de fileSystem.ts
 *  - saveAll() / saveRecipe() appellent writeJsonToHandle() → Go SaveConfig()
 *  - configHandle est toujours null (Go gère le chemin en interne)
 *  - Ajout de reopenLastProject() pour restaurer le dernier projet au démarrage
 */

import { create } from 'zustand';
import type {
  CraftingConfig,
  GameItem,
  Lang,
  TabId,
  ToastEntry,
  ToastType,
  Condition,
  Recipe,
  Category,
} from '../types';
import {
  writeJsonToHandle,
  writeCsvToHandle,
  parseCsvText,
  loadProjectFiles,
  reopenLastProject,
  openProjectByPath,
} from '../utils/fileSystem';

function genId() {
  return Math.random().toString(36).slice(2);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else cur += ch;
  }
  result.push(cur);
  return result;
}

interface AppState {
  projectName: string;
  projectIconUrl: string | null;
  items: GameItem[];
  itemIcons: Record<string, string>;
  itemNames: Record<string, string>;
  csvTexts: Record<number, string>;
  csvLines: string[];
  csvSnapshot: string[] | null;
  csvDirty: boolean;
  categoriesSnapshot: string | null; // JSON snapshot des categories avant édition
  csvHandle: null; // toujours null — Go gère le fichier
  configHandle: null; // toujours null — Go gère le fichier
  config: CraftingConfig;
  loading: boolean;
  dirty: boolean;
  dirtyKeys: Set<string>;
  snapshots: Record<string, Recipe>;
  snapshotKeys: Record<string, string>;
  currentKey: string | null;
  lang: Lang;
  activeTab: TabId;
  theme: 'dark' | 'light';
  toasts: ToastEntry[];
  missingFilesWarnings: string[];
  missingFilesOpen: boolean;

  // Actions
  setActiveTab: (t: TabId) => void;
  setTheme: (t: 'dark' | 'light') => void;
  openProject: () => Promise<void>;
  openProjectPath: (path: string) => Promise<void>;
  reopenLast: () => Promise<void>;
  saveAll: () => Promise<void>;
  saveRecipe: (key: string) => Promise<void>;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  markDirty: (key?: string | null) => void;
  checkRevert: (key: string) => void;
  snapshotIfClean: (key: string) => void;
  closeMissingFiles: () => void;

  setCurrentKey: (key: string | null) => void;
  createRecipe: (item: string, cat: string, qty: number) => Promise<void>;
  deleteRecipe: (key: string) => Promise<void>;
  renameRecipe: (oldKey: string, newKey: string) => void;
  discardRecipe: (key: string) => void;
  updateRecipeField: <K extends keyof Recipe>(
    key: string,
    field: K,
    value: Recipe[K],
  ) => void;
  updateIngredient: (
    recipeKey: string,
    oldItem: string,
    newItem: string | null,
    qty: number | null,
  ) => void;
  addIngredient: (recipeKey: string) => void;
  deleteIngredient: (recipeKey: string, item: string) => void;
  setRootCondition: (recipeKey: string, type: string) => void;
  updateConditionByPath: (
    recipeKey: string,
    path: string,
    field: string,
    value: unknown,
  ) => void;
  addChildCondition: (recipeKey: string, path: string, type: string) => void;
  removeChildCondition: (recipeKey: string, path: string, idx: number) => void;

  addCategory: (key: string, id: number, name: string) => Promise<void>;
  updateCategoryId: (idx: number, val: number) => void;
  updateCategoryTranslation: (
    lineIdx: number,
    colIdx: number,
    value: string,
  ) => void;
  saveCsv: () => Promise<void>;
  discardCsv: () => void;
  deleteCategory: (idx: number) => Promise<void>;
}

function getCondByPath(root: Condition, path: string): Condition {
  const parts = path.split('.').slice(1);
  let node = root;
  for (const p of parts) node = (node as any).conditions[parseInt(p)];
  return node;
}

// Helper : applique les données de projet dans le state
function applyProjectData(
  data: Awaited<ReturnType<typeof loadProjectFiles>>,
  get: () => AppState,
) {
  if (!data) return;
  console.log(
    '[store] applyProjectData:',
    data.projectName,
    '— recipes:',
    Object.keys(data.config.data).length,
    '— warnings:',
    data.warnings,
  );
  const recipeCount = Object.keys(data.config.data).length;
  const criticalWarnings = data.warnings.filter((w) => w !== 'csv_missing');
  const hasPluginIssue = data.warnings.some(
    (w) => w === 'csv_missing' || w === 'plugin_missing',
  );
  const warningsToShow = hasPluginIssue ? ['plugin_missing'] : criticalWarnings;

  useStore.setState({
    projectName: data.projectName,
    projectIconUrl: data.projectIconUrl,
    config: data.config,
    configHandle: null,
    items: data.items,
    itemIcons: data.itemIcons,
    itemNames: data.itemNames,
    csvHandle: null,
    csvTexts: data.csvTexts,
    csvLines: data.csvLines,
    csvDirty: false,
    csvSnapshot: null,
    categoriesSnapshot: null,
    dirty: false,
    dirtyKeys: new Set(),
    snapshots: {},
    snapshotKeys: {},
    currentKey: Object.keys(data.config.data)[0] ?? null,
    loading: false,
  });

  if (warningsToShow.length) {
    useStore.setState({
      missingFilesWarnings: warningsToShow,
      missingFilesOpen: true,
    });
  } else {
    get().addToast(
      `"${data.projectName}" — ${data.items.length} items, ${recipeCount} recipes`,
      'ok',
    );
  }
}

export const useStore = create<AppState>((set, get) => ({
  projectName: '',
  projectIconUrl: null,
  items: [],
  itemIcons: {},
  itemNames: {},
  csvTexts: {},
  csvLines: [],
  csvSnapshot: null,
  csvDirty: false,
  categoriesSnapshot: null,
  csvHandle: null,
  configHandle: null,
  config: { categories: [], data: {} },
  loading: false,
  dirty: false,
  dirtyKeys: new Set(),
  snapshots: {},
  snapshotKeys: {},
  currentKey: null,
  lang: 'en',
  activeTab: 'recipe',
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  toasts: [],
  missingFilesWarnings: [],
  missingFilesOpen: false,

  setActiveTab: (t) => set({ activeTab: t }),
  setTheme: (t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  closeMissingFiles: () => set({ missingFilesOpen: false }),

  addToast: (message, type = 'ok') => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  markDirty: (key) => {
    set((s) => {
      const nextKeys = new Set(s.dirtyKeys);
      if (key) nextKeys.add(key);
      return { dirty: true, dirtyKeys: nextKeys };
    });
  },

  checkRevert: (key) => {
    const s = get();
    const snap = s.snapshots[key];
    const current = s.config.data[key];
    if (snap && JSON.stringify(current) === JSON.stringify(snap)) {
      set((st) => {
        const nextKeys = new Set(st.dirtyKeys);
        nextKeys.delete(key);
        const nextSnaps = { ...st.snapshots };
        delete nextSnaps[key];
        return {
          dirtyKeys: nextKeys,
          dirty: nextKeys.size > 0,
          snapshots: nextSnaps,
        };
      });
    } else {
      get().markDirty(key);
    }
  },

  snapshotIfClean: (key) => {
    const s = get();
    if (!s.dirtyKeys.has(key) && s.config.data[key]) {
      set((st) => ({
        snapshots: {
          ...st.snapshots,
          [key]: JSON.parse(JSON.stringify(st.config.data[key])),
        },
      }));
    }
  },

  setCurrentKey: (key) => set({ currentKey: key }),

  // ── Open / Reopen ──────────────────────────────────────────────────────────

  openProject: async () => {
    console.log('[store] openProject called');
    set({ loading: true });
    try {
      const data = await loadProjectFiles();
      console.log(
        '[store] loadProjectFiles returned:',
        data ? data.projectName : 'null',
      );
      if (!data) {
        set({ loading: false });
        return;
      }
      applyProjectData(data, get);
    } catch (e: any) {
      console.error('[store] openProject error:', e);
      set({ loading: false });
      get().addToast('Load error: ' + e.message, 'err');
    }
  },

  openProjectPath: async (path: string) => {
    set({ loading: true });
    try {
      const data = await openProjectByPath(path);
      if (!data) {
        set({ loading: false });
        throw new Error('Project not found');
      }
      applyProjectData(data, get);
    } catch (e: any) {
      set({ loading: false });
      // Ne pas afficher de toast ici — le Dashboard gère l'état d'erreur visuellement
      throw e;
    }
  },

  reopenLast: async () => {
    set({ loading: true });
    try {
      const data = await reopenLastProject();
      if (!data) {
        set({ loading: false });
        return;
      }
      applyProjectData(data, get);
    } catch (e: any) {
      set({ loading: false });
      get().addToast('Could not reopen last project: ' + e.message, 'err');
    }
  },

  // ── Save ───────────────────────────────────────────────────────────────────

  saveAll: async () => {
    const s = get();
    try {
      await writeJsonToHandle(null, s.config);
      if (s.csvDirty) {
        await writeCsvToHandle(null, s.csvLines);
      }
      set({
        dirty: false,
        dirtyKeys: new Set(),
        snapshots: {},
        snapshotKeys: {},
        csvDirty: false,
        csvSnapshot: null,
        categoriesSnapshot: null,
      });
      get().addToast('All changes saved', 'ok');
    } catch (e: any) {
      get().addToast('Save error: ' + e.message, 'err');
    }
  },

  saveRecipe: async (key) => {
    const s = get();
    try {
      await writeJsonToHandle(null, s.config);
      const nextDirtyKeys = new Set(s.dirtyKeys);
      nextDirtyKeys.delete(key);
      const nextSnaps = { ...s.snapshots };
      delete nextSnaps[key];
      const nextSnapKeys = { ...s.snapshotKeys };
      delete nextSnapKeys[key];
      set({
        dirtyKeys: nextDirtyKeys,
        dirty: nextDirtyKeys.size > 0,
        snapshots: nextSnaps,
        snapshotKeys: nextSnapKeys,
      });
    } catch (e: any) {
      get().addToast('Save error: ' + e.message, 'err');
    }
  },

  // ── Recipes ────────────────────────────────────────────────────────────────

  discardRecipe: (key) => {
    set((s) => {
      const snap = s.snapshots[key];
      if (!snap) return {};
      const originalKey = s.snapshotKeys[key] ?? key;
      const nextData = { ...s.config.data };
      if (originalKey !== key) delete nextData[key];
      const reordered: typeof nextData = {};
      for (const k of Object.keys(s.config.data)) {
        if (k === key)
          reordered[originalKey] = JSON.parse(JSON.stringify(snap));
        else if (k !== originalKey) reordered[k] = nextData[k];
      }
      if (!reordered[originalKey])
        reordered[originalKey] = JSON.parse(JSON.stringify(snap));
      const nextDirtyKeys = new Set(s.dirtyKeys);
      nextDirtyKeys.delete(key);
      const nextSnaps = { ...s.snapshots };
      delete nextSnaps[key];
      const nextSnapshotKeys = { ...s.snapshotKeys };
      delete nextSnapshotKeys[key];
      return {
        config: { ...s.config, data: reordered },
        currentKey: originalKey,
        dirtyKeys: nextDirtyKeys,
        snapshots: nextSnaps,
        snapshotKeys: nextSnapshotKeys,
        dirty: nextDirtyKeys.size > 0,
      };
    });
    get().addToast(`"${get().currentKey}" reverted`, 'info');
  },

  createRecipe: async (item, cat, qty) => {
    const s = get();
    if (s.config.data[item]) {
      get().addToast(`A recipe for "${item}" already exists`, 'err');
      return;
    }
    const newConfig: CraftingConfig = {
      ...s.config,
      data: {
        ...s.config.data,
        [item]: {
          ingredients: {},
          result: item,
          quantity: qty,
          category: cat || 'all',
          unlock_condition: { type: 'manual', value: true },
        },
      },
    };
    set({ config: newConfig });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false, currentKey: item, activeTab: 'recipe' });
    get().addToast(`"${item}" created`, 'ok');
  },

  deleteRecipe: async (key) => {
    const s = get();
    const newData = { ...s.config.data };
    delete newData[key];
    const newConfig = { ...s.config, data: newData };
    const newDirty = new Set(s.dirtyKeys);
    newDirty.delete(key);
    const newSnaps = { ...s.snapshots };
    delete newSnaps[key];
    const newSnapKeys = { ...s.snapshotKeys };
    delete newSnapKeys[key];
    set({
      config: newConfig,
      dirtyKeys: newDirty,
      snapshots: newSnaps,
      snapshotKeys: newSnapKeys,
      currentKey: null,
    });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false });
    get().addToast(`"${key}" deleted`, 'ok');
  },

  renameRecipe: (oldKey, newKey) => {
    const s = get();
    if (!s.config.data[oldKey]) return;
    if (s.config.data[newKey]) {
      get().addToast(`"${newKey}" already exists`, 'err');
      return;
    }
    const newData: typeof s.config.data = {};
    for (const k of Object.keys(s.config.data)) {
      if (k === oldKey)
        newData[newKey] = { ...s.config.data[k], result: newKey };
      else newData[k] = s.config.data[k];
    }
    const newDirtyKeys = new Set(s.dirtyKeys);
    const newSnaps = { ...s.snapshots };
    if (newDirtyKeys.has(oldKey)) {
      newDirtyKeys.delete(oldKey);
      newDirtyKeys.add(newKey);
    }
    if (newSnaps[oldKey]) {
      newSnaps[newKey] = newSnaps[oldKey];
      delete newSnaps[oldKey];
    }
    if (!newDirtyKeys.has(newKey) && s.config.data[oldKey]) {
      newSnaps[newKey] = JSON.parse(JSON.stringify(s.config.data[oldKey]));
      newDirtyKeys.add(newKey);
    }
    const newSnapshotKeys = { ...s.snapshotKeys };
    newSnapshotKeys[newKey] = newSnapshotKeys[oldKey] ?? oldKey;
    delete newSnapshotKeys[oldKey];
    set({
      config: { ...s.config, data: newData },
      currentKey: newKey,
      dirtyKeys: newDirtyKeys,
      snapshots: newSnaps,
      snapshotKeys: newSnapshotKeys,
      dirty: true,
    });
  },

  updateRecipeField: (key, field, value) => {
    get().snapshotIfClean(key);
    set((s) => ({
      config: {
        ...s.config,
        data: {
          ...s.config.data,
          [key]: { ...s.config.data[key], [field]: value },
        },
      },
    }));
    get().checkRevert(key);
  },

  addIngredient: (recipeKey) => {
    const s = get();
    const ingr = { ...(s.config.data[recipeKey].ingredients || {}) };
    let k = 'new_item';
    let i = 1;
    while (ingr[k]) k = `new_item_${i++}`;
    ingr[k] = 1;
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  deleteIngredient: (recipeKey, item) => {
    const s = get();
    const ingr = { ...(s.config.data[recipeKey].ingredients || {}) };
    delete ingr[item];
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  updateIngredient: (recipeKey, oldItem, newItem, qty) => {
    const s = get();
    const ingr = { ...(s.config.data[recipeKey].ingredients || {}) };
    if (newItem !== null && newItem !== oldItem) {
      const v = ingr[oldItem];
      delete ingr[oldItem];
      ingr[newItem] = v;
    }
    const finalKey = newItem ?? oldItem;
    if (qty !== null) ingr[finalKey] = qty;
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  setRootCondition: (recipeKey, type) => {
    const defaults: Record<string, Condition> = {
      manual: { type: 'manual', value: true },
      switch: { type: 'switch', id: 0 },
      variable: { type: 'variable', id: 0, value: 0 },
      recipe: { type: 'recipe', key: '' },
      operator: { operator: 'and', conditions: [] },
    };
    get().updateRecipeField(recipeKey, 'unlock_condition', defaults[type]);
  },

  updateConditionByPath: (recipeKey, path, field, value) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(
        JSON.stringify(recipe.unlock_condition),
      );
      (getCondByPath(cond, path) as any)[field] = value;
      return {
        config: {
          ...s.config,
          data: {
            ...s.config.data,
            [recipeKey]: { ...recipe, unlock_condition: cond },
          },
        },
      };
    });
    get().checkRevert(recipeKey);
  },

  addChildCondition: (recipeKey, path, type) => {
    get().snapshotIfClean(recipeKey);
    const defaults: Record<string, Condition> = {
      manual: { type: 'manual', value: true },
      switch: { type: 'switch', id: 0 },
      variable: { type: 'variable', id: 0, value: 0 },
      recipe: { type: 'recipe', key: '' },
    };
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(
        JSON.stringify(recipe.unlock_condition),
      );
      const node = getCondByPath(cond, path) as any;
      if (!node.conditions) node.conditions = [];
      node.conditions.push(defaults[type]);
      return {
        config: {
          ...s.config,
          data: {
            ...s.config.data,
            [recipeKey]: { ...recipe, unlock_condition: cond },
          },
        },
      };
    });
    get().checkRevert(recipeKey);
  },

  removeChildCondition: (recipeKey, path, idx) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(
        JSON.stringify(recipe.unlock_condition),
      );
      (getCondByPath(cond, path) as any).conditions.splice(idx, 1);
      return {
        config: {
          ...s.config,
          data: {
            ...s.config.data,
            [recipeKey]: { ...recipe, unlock_condition: cond },
          },
        },
      };
    });
    get().checkRevert(recipeKey);
  },

  // ── Categories ─────────────────────────────────────────────────────────────

  addCategory: async (key, id, name) => {
    const s = get();
    if (s.config.categories.find((c) => Object.keys(c)[0] === key)) {
      get().addToast('Category already exists', 'err');
      return;
    }
    const newCategories: Category[] = [...s.config.categories, { [key]: id }];
    const newConfig = { ...s.config, categories: newCategories };
    let newCsvLines = [...s.csvLines];
    let newCsvTexts = { ...s.csvTexts };
    if (s.csvHandle !== null || name) {
      // csvHandle est null mais on continue
      while (newCsvLines.length <= id) newCsvLines.push('');
      newCsvLines[id] = name;
      const parsed = parseCsvText(newCsvLines.join('\n'));
      newCsvTexts = parsed.texts;
      newCsvLines = parsed.lines;
      try {
        await writeCsvToHandle(null, newCsvLines);
      } catch (e: any) {
        get().addToast('CSV write error: ' + e.message, 'warn');
      }
    }
    set({ config: newConfig, csvLines: newCsvLines, csvTexts: newCsvTexts });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false, categoriesSnapshot: null });
    get().addToast(`"${key}" added → CSV[${id}] = "${name}"`, 'ok');
  },

  updateCategoryId: (idx, val) => {
    set((s) => {
      // Snapshot au premier changement
      const categoriesSnapshot =
        s.categoriesSnapshot ?? JSON.stringify(s.config.categories);
      const cats = [...s.config.categories];
      const key = Object.keys(cats[idx])[0];
      cats[idx] = { [key]: val };
      const newConfig = { ...s.config, categories: cats };
      // Vérifier si on est revenu à l'état initial
      const isDirty = JSON.stringify(cats) !== categoriesSnapshot;
      return {
        config: newConfig,
        categoriesSnapshot: isDirty ? categoriesSnapshot : null,
        dirty: isDirty || s.dirtyKeys.size > 0,
      };
    });
  },

  updateCategoryTranslation: (lineIdx, colIdx, value) => {
    set((s) => {
      const lines = [...s.csvLines];
      const snapshot = s.csvSnapshot ?? [...s.csvLines];
      const cols = parseCsvLine(lines[lineIdx] || '');
      while (cols.length <= colIdx) cols.push('');
      cols[colIdx] = value;
      lines[lineIdx] = cols
        .map((c) => (c.includes(',') ? `"${c}"` : c))
        .join(',');
      const { texts, lines: newLines } = parseCsvText(lines.join('\n'));
      // Vérifier si on est revenu à l'état initial
      const isDirty = newLines.join('\n') !== snapshot.join('\n');
      return {
        csvLines: newLines,
        csvTexts: texts,
        csvSnapshot: isDirty ? snapshot : null,
        csvDirty: isDirty,
      };
    });
  },

  saveCsv: async () => {
    const s = get();
    try {
      await writeCsvToHandle(null, s.csvLines);
      set({ csvDirty: false, csvSnapshot: null });
      get().addToast('CSV saved', 'ok');
    } catch (e: any) {
      get().addToast('CSV write error: ' + e.message, 'err');
    }
  },

  discardCsv: () => {
    set((s) => {
      if (!s.csvSnapshot) return {};
      const { texts, lines } = parseCsvText(s.csvSnapshot.join('\n'));
      return {
        csvLines: lines,
        csvTexts: texts,
        csvSnapshot: null,
        csvDirty: false,
      };
    });
    get().addToast('CSV changes discarded', 'info');
  },

  deleteCategory: async (idx) => {
    const s = get();
    const key = Object.keys(s.config.categories[idx])[0];
    const newCats = s.config.categories.filter((_, i) => i !== idx);
    const newData = { ...s.config.data };
    let migrated = 0;
    for (const [rk, recipe] of Object.entries(newData)) {
      if (recipe.category === key) {
        const { category: _, ...rest } = recipe;
        newData[rk] = rest as typeof recipe;
        migrated++;
      }
    }
    const newConfig = { ...s.config, categories: newCats, data: newData };
    set({ config: newConfig });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false, categoriesSnapshot: null });
    const hint =
      migrated > 0
        ? ` (${migrated} recipe${migrated > 1 ? 's' : ''} uncategorized)`
        : '';
    get().addToast(`"${key}" deleted${hint}`, 'ok');
  },
}));
