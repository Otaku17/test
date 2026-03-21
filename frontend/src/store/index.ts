/**
 * store/index.ts
 *
 * Global Zustand store for the Wails desktop build.
 *
 * Key design decisions:
 *  - configHandle and csvHandle are always null — Go owns the file paths.
 *  - openProject / openProjectPath / reopenLast delegate I/O to fileSystem.ts.
 *  - saveAll / saveRecipe delegate writes to Go via writeJsonToHandle.
 *  - loadQuests is called after every project open; it is non-blocking.
 */

import { create } from 'zustand';
import type {
  CraftingConfig,
  GameItem,
  GameQuest,
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
  loadQuestFiles,
  reopenLastProject,
  openProjectByPath,
  parseRawProjectData,
} from '../utils/fileSystem';
import { touchProject } from '../utils/projectTimestamps';

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2);
}

function parseCsvLine(line: string): string[] {
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

/**
 * Traverses a condition tree following a dot-separated path.
 * Path segments:
 *  - A numeric index: navigate into `conditions[i]` (AND / OR).
 *  - The literal "not": navigate into `condition` (NOT).
 */
function getCondByPath(root: Condition, path: string): Condition {
  const parts = path.split('.').slice(1);
  let node: any = root;
  for (const p of parts) {
    if (p === 'not') node = node.condition;
    else node = node.conditions[parseInt(p)];
  }
  return node;
}

// ── State interface ───────────────────────────────────────────────────────────

interface AppState {
  // Project
  projectName:    string;
  projectPath:    string;
  projectIconUrl: string | null;

  // Items
  items:     GameItem[];
  itemIcons: Record<string, string>;
  itemNames: Record<string, string>;

  // Quests
  quests:     GameQuest[];
  questNames: Record<string, string>;

  // Category CSV (140000.csv)
  csvTexts:           Record<number, string>;
  csvLines:           string[];
  csvSnapshot:        string[] | null;
  csvDirty:           boolean;
  categoriesSnapshot: string | null;

  // File handles — always null in the desktop build (Go owns paths)
  csvHandle:    null;
  configHandle: null;

  // Config
  config: CraftingConfig;

  // UI state
  loading:  boolean;
  loadingStep: { label: string; current: number; total: number } | null;
  dirty:    boolean;
  dirtyKeys:    Set<string>;
  snapshots:    Record<string, Recipe>;
  snapshotKeys: Record<string, string>;
  currentKey:   string | null;
  lang:         Lang;
  activeTab:    TabId;
  theme:        'dark' | 'light';
  toasts:       ToastEntry[];

  // Missing-files modal
  missingFilesWarnings: string[];
  missingFilesOpen:     boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  setActiveTab:      (t: TabId) => void;
  setTheme:          (t: 'dark' | 'light') => void;
  openProject:       () => Promise<void>;
  openProjectPath:   (path: string) => Promise<void>;
  reopenLast:        () => Promise<void>;
  applyRawProject:   (raw: unknown) => void;
  loadQuests:        () => Promise<void>;
  saveAll:           () => Promise<void>;
  saveRecipe:        (key: string) => Promise<void>;
  addToast:          (message: string, type?: ToastType) => void;
  removeToast:       (id: string) => void;
  markDirty:         (key?: string | null) => void;
  checkRevert:       (key: string) => void;
  snapshotIfClean:   (key: string) => void;
  closeMissingFiles: () => void;

  setCurrentKey:    (key: string | null) => void;
  createRecipe:     (item: string, cat: string, qty: number) => Promise<void>;
  deleteRecipe:     (key: string) => Promise<void>;
  renameRecipe:     (oldKey: string, newKey: string) => void;
  discardRecipe:    (key: string) => void;
  updateRecipeField: <K extends keyof Recipe>(key: string, field: K, value: Recipe[K]) => void;
  updateIngredient:  (recipeKey: string, oldItem: string, newItem: string | null, qty: number | null) => void;
  addIngredient:     (recipeKey: string) => void;
  deleteIngredient:  (recipeKey: string, item: string) => void;

  setRootCondition:       (recipeKey: string, type: string) => void;
  setNotInnerCondition:   (recipeKey: string, path: string, type: string) => void;
  updateConditionByPath:  (recipeKey: string, path: string, field: string, value: unknown) => void;
  addChildCondition:      (recipeKey: string, path: string, type: string) => void;
  removeChildCondition:   (recipeKey: string, path: string, idx: number) => void;

  addCategory:              (key: string, id: number, name: string) => Promise<void>;
  updateCategoryId:         (idx: number, val: number) => void;
  renameCategory:           (idx: number, newKey: string) => Promise<string | null>;
  updateCategoryTranslation:(lineIdx: number, colIdx: number, value: string) => void;
  saveCsv:                  () => Promise<void>;
  discardCsv:               () => void;
  deleteCategory:           (idx: number) => Promise<void>;
  migrateCategoryRecipes:   (fromKey: string, toKey: string) => Promise<void>;
}

// ── Project loader helper ─────────────────────────────────────────────────────

/**
 * Applies loaded project data to the store, resets all dirty/snapshot state,
 * and shows either a success toast or the missing-files modal.
 */
function applyProjectData(
  data: Awaited<ReturnType<typeof loadProjectFiles>>,
  get: () => AppState,
) {
  if (!data) return;

  const recipeCount = Object.keys(data.config.data).length;
  const hasPluginIssue = data.warnings.some(
    (w) => w === 'csv_missing' || w === 'plugin_missing',
  );
  const criticalWarnings = data.warnings.filter((w) => w !== 'csv_missing');
  const warningsToShow = hasPluginIssue ? ['plugin_missing'] : criticalWarnings;

  useStore.setState({
    projectName:        data.projectName,
    projectPath:        data.projectPath,
    projectIconUrl:     data.projectIconUrl,
    config:             data.config,
    configHandle:       null,
    items:              data.items,
    itemIcons:          data.itemIcons,
    itemNames:          data.itemNames,
    quests:             [],
    questNames:         {},
    csvHandle:          null,
    csvTexts:           data.csvTexts,
    csvLines:           data.csvLines,
    csvDirty:           false,
    csvSnapshot:        null,
    categoriesSnapshot: null,
    dirty:              false,
    dirtyKeys:          new Set(),
    snapshots:          {},
    snapshotKeys:       {},
    currentKey:         Object.keys(data.config.data)[0] ?? null,
    loading:            false,
    loadingStep:        null,
  });

  if (data.projectPath) touchProject(data.projectPath);

  if (warningsToShow.length) {
    useStore.setState({ missingFilesWarnings: warningsToShow, missingFilesOpen: true });
  } else {
    get().addToast(
      `"${data.projectName}" — ${data.items.length} items, ${recipeCount} recipes`,
      'ok',
    );
  }
}

// ── Default condition values ───────────────────────────────────────────────────

const CONDITION_DEFAULTS: Record<string, Condition> = {
  manual:   { type: 'manual', value: true },
  switch:   { type: 'switch', id: 0 },
  variable: { type: 'variable', id: 0, value: 0 },
  recipe:   { type: 'recipe', key: '' },
  quest:    { type: 'quest', key: '' },
  operator: { operator: 'and', conditions: [] },
  not:      { operator: 'not', condition: { type: 'manual', value: true } },
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────

  projectName:          '',
  projectPath:          '',
  projectIconUrl:       null,
  items:                [],
  itemIcons:            {},
  itemNames:            {},
  quests:               [],
  questNames:           {},
  csvTexts:             {},
  csvLines:             [],
  csvSnapshot:          null,
  csvDirty:             false,
  categoriesSnapshot:   null,
  csvHandle:            null,
  configHandle:         null,
  config:               { categories: [], data: {} },
  loading:              false,
  loadingStep:          null,
  dirty:                false,
  dirtyKeys:            new Set(),
  snapshots:            {},
  snapshotKeys:         {},
  currentKey:           null,
  lang:                 'en',
  activeTab:            'recipe',
  theme:                (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  toasts:               [],
  missingFilesWarnings: [],
  missingFilesOpen:     false,

  // ── UI ───────────────────────────────────────────────────────────────────

  setActiveTab: (t) => set({ activeTab: t }),

  setTheme: (t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },

  closeMissingFiles: () => set({ missingFilesOpen: false }),

  // ── Toasts ───────────────────────────────────────────────────────────────

  addToast: (message, type = 'ok') => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ── Dirty tracking ────────────────────────────────────────────────────────

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
        return { dirtyKeys: nextKeys, dirty: nextKeys.size > 0, snapshots: nextSnaps };
      });
    } else {
      get().markDirty(key);
    }
  },

  snapshotIfClean: (key) => {
    const s = get();
    if (!s.dirtyKeys.has(key) && s.config.data[key]) {
      set((st) => ({
        snapshots: { ...st.snapshots, [key]: JSON.parse(JSON.stringify(st.config.data[key])) },
      }));
    }
  },

  setCurrentKey: (key) => set({ currentKey: key }),

  // ── Open / reopen ─────────────────────────────────────────────────────────

  openProject: async () => {
    const STEPS = [
      'Ouverture du dossier…',
      'Lecture de la configuration…',
      'Chargement des items…',
      'Chargement des textes CSV…',
      'Finalisation…',
    ];
    set({ loading: true, loadingStep: { label: STEPS[0], current: 1, total: STEPS.length } });
    try {
      await new Promise(r => setTimeout(r, 80));
      set({ loadingStep: { label: STEPS[1], current: 2, total: STEPS.length } });
      const data = await loadProjectFiles();
      if (!data) { set({ loading: false, loadingStep: null }); return; }
      set({ loadingStep: { label: STEPS[2], current: 3, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[3], current: 4, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[4], current: 5, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      applyProjectData(data, get);
      get().loadQuests();
    } catch (e: any) {
      set({ loading: false, loadingStep: null });
      get().addToast('Load error: ' + e.message, 'err');
    }
  },

  openProjectPath: async (path) => {
    const STEPS = [
      'Ouverture du projet…',
      'Lecture de la configuration…',
      'Chargement des items…',
      'Chargement des textes CSV…',
      'Finalisation…',
    ];
    set({ loading: true, loadingStep: { label: STEPS[0], current: 1, total: STEPS.length } });
    try {
      await new Promise(r => setTimeout(r, 80));
      set({ loadingStep: { label: STEPS[1], current: 2, total: STEPS.length } });
      const data = await openProjectByPath(path);
      if (!data) { set({ loading: false, loadingStep: null }); throw new Error('Project not found'); }
      set({ loadingStep: { label: STEPS[2], current: 3, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[3], current: 4, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[4], current: 5, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      applyProjectData(data, get);
      get().loadQuests();
    } catch (e: any) {
      set({ loading: false, loadingStep: null });
      throw e; // re-throw so Dashboard can handle it visually
    }
  },

  reopenLast: async () => {
    const STEPS = [
      'Recherche du dernier projet…',
      'Lecture de la configuration…',
      'Chargement des items…',
      'Chargement des textes CSV…',
      'Finalisation…',
    ];
    set({ loading: true, loadingStep: { label: STEPS[0], current: 1, total: STEPS.length } });
    try {
      await new Promise(r => setTimeout(r, 80));
      set({ loadingStep: { label: STEPS[1], current: 2, total: STEPS.length } });
      const data = await reopenLastProject();
      if (!data) { set({ loading: false, loadingStep: null }); return; }
      set({ loadingStep: { label: STEPS[2], current: 3, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[3], current: 4, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      set({ loadingStep: { label: STEPS[4], current: 5, total: STEPS.length } });
      await new Promise(r => setTimeout(r, 60));
      applyProjectData(data, get);
      get().loadQuests();
    } catch (e: any) {
      set({ loading: false, loadingStep: null });
      get().addToast('Could not reopen last project: ' + e.message, 'err');
    }
  },

  applyRawProject: (raw: unknown) => {
    const data = parseRawProjectData(raw as any);
    if (!data) return;
    applyProjectData(data, get);
    get().loadQuests();
  },

  loadQuests: async () => {
    try {
      const { quests, questNames } = await loadQuestFiles();
      set({ quests, questNames });
      if (quests.length > 0)
        console.log('[store] loadQuests:', quests.length, 'quests loaded');
    } catch {
      // Non-blocking — GetQuests may not be implemented yet on the Go side
    }
  },

  // ── Save ─────────────────────────────────────────────────────────────────

  saveAll: async () => {
    const s = get();
    try {
      await writeJsonToHandle(null, s.config);
      if (s.csvDirty) await writeCsvToHandle(null, s.csvLines);
      set({
        dirty:              false,
        dirtyKeys:          new Set(),
        snapshots:          {},
        snapshotKeys:       {},
        csvDirty:           false,
        csvSnapshot:        null,
        categoriesSnapshot: null,
      });
      if (s.projectPath) touchProject(s.projectPath);
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
      const nextSnaps    = { ...s.snapshots };    delete nextSnaps[key];
      const nextSnapKeys = { ...s.snapshotKeys }; delete nextSnapKeys[key];
      set({ dirtyKeys: nextDirtyKeys, dirty: nextDirtyKeys.size > 0, snapshots: nextSnaps, snapshotKeys: nextSnapKeys });
      if (s.projectPath) touchProject(s.projectPath);
    } catch (e: any) {
      get().addToast('Save error: ' + e.message, 'err');
    }
  },

  // ── Recipes ───────────────────────────────────────────────────────────────

  discardRecipe: (key) => {
    set((s) => {
      const snap = s.snapshots[key];
      if (!snap) return {};
      const originalKey = s.snapshotKeys[key] ?? key;
      const nextData: typeof s.config.data = {};
      // Rebuild map preserving insertion order, swapping the renamed key back
      for (const k of Object.keys(s.config.data)) {
        if (k === key)         nextData[originalKey] = JSON.parse(JSON.stringify(snap));
        else if (k !== originalKey) nextData[k] = s.config.data[k];
      }
      if (!nextData[originalKey]) nextData[originalKey] = JSON.parse(JSON.stringify(snap));
      const nextDirtyKeys  = new Set(s.dirtyKeys);  nextDirtyKeys.delete(key);
      const nextSnaps      = { ...s.snapshots };     delete nextSnaps[key];
      const nextSnapshotKeys = { ...s.snapshotKeys }; delete nextSnapshotKeys[key];
      return {
        config:       { ...s.config, data: nextData },
        currentKey:   originalKey,
        dirtyKeys:    nextDirtyKeys,
        snapshots:    nextSnaps,
        snapshotKeys: nextSnapshotKeys,
        dirty:        nextDirtyKeys.size > 0,
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
          result:      item,
          quantity:    qty,
          category:    cat || 'all',
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
    const newConfig     = { ...s.config, data: newData };
    const newDirty      = new Set(s.dirtyKeys); newDirty.delete(key);
    const newSnaps      = { ...s.snapshots };   delete newSnaps[key];
    const newSnapKeys   = { ...s.snapshotKeys }; delete newSnapKeys[key];
    set({ config: newConfig, dirtyKeys: newDirty, snapshots: newSnaps, snapshotKeys: newSnapKeys, currentKey: null });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false });
    get().addToast(`"${key}" deleted`, 'ok');
  },

  renameRecipe: (oldKey, newKey) => {
    const s = get();
    if (!s.config.data[oldKey]) return;
    if (s.config.data[newKey]) { get().addToast(`"${newKey}" already exists`, 'err'); return; }
    const newData: typeof s.config.data = {};
    for (const k of Object.keys(s.config.data)) {
      newData[k === oldKey ? newKey : k] = k === oldKey
        ? { ...s.config.data[k], result: newKey }
        : s.config.data[k];
    }
    const newDirtyKeys = new Set(s.dirtyKeys);
    const newSnaps     = { ...s.snapshots };
    if (newDirtyKeys.has(oldKey)) { newDirtyKeys.delete(oldKey); newDirtyKeys.add(newKey); }
    if (newSnaps[oldKey])         { newSnaps[newKey] = newSnaps[oldKey]; delete newSnaps[oldKey]; }
    if (!newDirtyKeys.has(newKey) && s.config.data[oldKey]) {
      newSnaps[newKey] = JSON.parse(JSON.stringify(s.config.data[oldKey]));
      newDirtyKeys.add(newKey);
    }
    const newSnapshotKeys = { ...s.snapshotKeys };
    newSnapshotKeys[newKey] = newSnapshotKeys[oldKey] ?? oldKey;
    delete newSnapshotKeys[oldKey];
    set({ config: { ...s.config, data: newData }, currentKey: newKey, dirtyKeys: newDirtyKeys, snapshots: newSnaps, snapshotKeys: newSnapshotKeys, dirty: true });
  },

  updateRecipeField: (key, field, value) => {
    get().snapshotIfClean(key);
    set((s) => ({
      config: { ...s.config, data: { ...s.config.data, [key]: { ...s.config.data[key], [field]: value } } },
    }));
    get().checkRevert(key);
  },

  addIngredient: (recipeKey) => {
    const ingr = { ...(get().config.data[recipeKey].ingredients || {}) };
    let k = 'new_item', i = 1;
    while (ingr[k]) k = `new_item_${i++}`;
    ingr[k] = 1;
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  deleteIngredient: (recipeKey, item) => {
    const ingr = { ...(get().config.data[recipeKey].ingredients || {}) };
    delete ingr[item];
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  updateIngredient: (recipeKey, oldItem, newItem, qty) => {
    const ingr = { ...(get().config.data[recipeKey].ingredients || {}) };
    if (newItem !== null && newItem !== oldItem) {
      const v = ingr[oldItem]; delete ingr[oldItem]; ingr[newItem] = v;
    }
    const finalKey = newItem ?? oldItem;
    if (qty !== null) ingr[finalKey] = qty;
    get().updateRecipeField(recipeKey, 'ingredients', ingr);
  },

  // ── Conditions ────────────────────────────────────────────────────────────

  setRootCondition: (recipeKey, type) => {
    get().updateRecipeField(recipeKey, 'unlock_condition', CONDITION_DEFAULTS[type]);
  },

  setNotInnerCondition: (recipeKey, path, type) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(JSON.stringify(recipe.unlock_condition));
      (getCondByPath(cond, path) as any).condition = CONDITION_DEFAULTS[type];
      return { config: { ...s.config, data: { ...s.config.data, [recipeKey]: { ...recipe, unlock_condition: cond } } } };
    });
    get().checkRevert(recipeKey);
  },

  updateConditionByPath: (recipeKey, path, field, value) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(JSON.stringify(recipe.unlock_condition));
      const node = getCondByPath(cond, path) as any;

      if (field === 'operator') {
        // Migrate structure when switching between NOT and AND/OR
        const prev = node.operator, next = value as string;
        node.operator = next;
        if (next === 'not' && prev !== 'not') {
          // Promote first child (or a default) as the single inner condition
          node.condition = (node.conditions || [])[0] ?? { type: 'manual', value: true };
          delete node.conditions;
        } else if (next !== 'not' && prev === 'not') {
          // Wrap the inner condition back into a list
          node.conditions = node.condition ? [node.condition] : [];
          delete node.condition;
        }
      } else {
        node[field] = value;
      }

      return { config: { ...s.config, data: { ...s.config.data, [recipeKey]: { ...recipe, unlock_condition: cond } } } };
    });
    get().checkRevert(recipeKey);
  },

  addChildCondition: (recipeKey, path, type) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(JSON.stringify(recipe.unlock_condition));
      const node = getCondByPath(cond, path) as any;
      if (!node.conditions) node.conditions = [];
      node.conditions.push(CONDITION_DEFAULTS[type]);
      return { config: { ...s.config, data: { ...s.config.data, [recipeKey]: { ...recipe, unlock_condition: cond } } } };
    });
    get().checkRevert(recipeKey);
  },

  removeChildCondition: (recipeKey, path, idx) => {
    get().snapshotIfClean(recipeKey);
    set((s) => {
      const recipe = s.config.data[recipeKey];
      const cond: Condition = JSON.parse(JSON.stringify(recipe.unlock_condition));
      (getCondByPath(cond, path) as any).conditions.splice(idx, 1);
      return { config: { ...s.config, data: { ...s.config.data, [recipeKey]: { ...recipe, unlock_condition: cond } } } };
    });
    get().checkRevert(recipeKey);
  },

  // ── Categories ────────────────────────────────────────────────────────────

  addCategory: async (key, id, name) => {
    const s = get();
    if (s.config.categories.find((c) => Object.keys(c)[0] === key)) {
      get().addToast('Category already exists', 'err');
      return;
    }
    const newCategories: Category[] = [...s.config.categories, { [key]: id }];
    const newConfig = { ...s.config, categories: newCategories };
    let newCsvLines  = [...s.csvLines];
    let newCsvTexts  = { ...s.csvTexts };
    if (name) {
      while (newCsvLines.length <= id) newCsvLines.push('');
      newCsvLines[id] = name;
      const parsed = parseCsvText(newCsvLines.join('\n'));
      newCsvTexts = parsed.texts;
      newCsvLines = parsed.lines;
      try { await writeCsvToHandle(null, newCsvLines); }
      catch (e: any) { get().addToast('CSV write error: ' + e.message, 'warn'); }
    }
    set({ config: newConfig, csvLines: newCsvLines, csvTexts: newCsvTexts });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false, categoriesSnapshot: null });
    get().addToast(`"${key}" added → CSV[${id}] = "${name}"`, 'ok');
  },

  renameCategory: async (idx, newKey) => {
    const s = get();
    const trimmed = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return null;
    const oldKey = Object.keys(s.config.categories[idx])[0];
    if (oldKey === trimmed) return trimmed;
    if (s.config.categories.find((c) => Object.keys(c)[0] === trimmed)) {
      get().addToast('A category with this key already exists', 'err');
      return null;
    }
    const cats = [...s.config.categories];
    cats[idx] = { [trimmed]: Object.values(cats[idx])[0] as number };
    const newData = { ...s.config.data };
    let migrated = 0;
    for (const [rk, recipe] of Object.entries(newData)) {
      if (recipe.category === oldKey) {
        newData[rk] = { ...recipe, category: trimmed };
        migrated++;
      }
    }
    const newConfig = { ...s.config, categories: cats, data: newData };
    set({ config: newConfig });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false, categoriesSnapshot: null });
    const hint = migrated > 0 ? ` — ${migrated} recipe${migrated > 1 ? 's' : ''} updated` : '';
    get().addToast(`Renamed "${oldKey}" → "${trimmed}"${hint}`, 'ok');
    return trimmed;
  },

  updateCategoryId: (idx, val) => {
    set((s) => {
      const categoriesSnapshot = s.categoriesSnapshot ?? JSON.stringify(s.config.categories);
      const cats = [...s.config.categories];
      const key  = Object.keys(cats[idx])[0];
      cats[idx]  = { [key]: val };
      const newConfig = { ...s.config, categories: cats };
      const isDirty   = JSON.stringify(cats) !== categoriesSnapshot;
      return {
        config:             newConfig,
        categoriesSnapshot: isDirty ? categoriesSnapshot : null,
        dirty:              isDirty || s.dirtyKeys.size > 0,
      };
    });
  },

  updateCategoryTranslation: (lineIdx, colIdx, value) => {
    set((s) => {
      const lines    = [...s.csvLines];
      const snapshot = s.csvSnapshot ?? [...s.csvLines];
      const cols     = parseCsvLine(lines[lineIdx] || '');
      while (cols.length <= colIdx) cols.push('');
      cols[colIdx]   = value;
      lines[lineIdx] = cols.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',');
      const { texts, lines: newLines } = parseCsvText(lines.join('\n'));
      const isDirty = newLines.join('\n') !== snapshot.join('\n');
      return { csvLines: newLines, csvTexts: texts, csvSnapshot: isDirty ? snapshot : null, csvDirty: isDirty };
    });
  },

  saveCsv: async () => {
    const s = get();
    try {
      await writeCsvToHandle(null, s.csvLines);
      set({ csvDirty: false, csvSnapshot: null });
      if (s.projectPath) touchProject(s.projectPath);
      get().addToast('CSV saved', 'ok');
    } catch (e: any) {
      get().addToast('CSV write error: ' + e.message, 'err');
    }
  },

  discardCsv: () => {
    set((s) => {
      if (!s.csvSnapshot) return {};
      const { texts, lines } = parseCsvText(s.csvSnapshot.join('\n'));
      return { csvLines: lines, csvTexts: texts, csvSnapshot: null, csvDirty: false };
    });
    get().addToast('CSV changes discarded', 'info');
  },

  migrateCategoryRecipes: async (fromKey, toKey) => {
    const s = get();
    const newData = { ...s.config.data };
    let migrated = 0;
    for (const [rk, recipe] of Object.entries(newData)) {
      if (recipe.category === fromKey) {
        newData[rk] = { ...recipe, category: toKey };
        migrated++;
      }
    }
    if (migrated === 0) {
      get().addToast(`No recipes were using "${fromKey}"`, 'info');
      return;
    }
    const newConfig = { ...s.config, data: newData };
    set({ config: newConfig });
    await writeJsonToHandle(null, newConfig);
    set({ dirty: false });
    get().addToast(`${migrated} recipe${migrated > 1 ? 's' : ''} moved from "${fromKey}" → "${toKey}"`, 'ok');
  },

  deleteCategory: async (idx) => {
    const s   = get();
    const key = Object.keys(s.config.categories[idx])[0];
    const newCats = s.config.categories.filter((_, i) => i !== idx);
    const newData = { ...s.config.data };
    let migrated  = 0;
    // Remove category from recipes that used it
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
    const hint = migrated > 0 ? ` (${migrated} recipe${migrated > 1 ? 's' : ''} uncategorized)` : '';
    get().addToast(`"${key}" deleted${hint}`, 'ok');
  },
}));
