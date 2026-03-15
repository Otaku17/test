// ─── Condition types ─────────────────────────────────────────────────────────

export type ConditionType = 'manual' | 'switch' | 'variable' | 'recipe' | 'operator';

export interface ManualCondition {
  type: 'manual';
  value: boolean;
}

export interface SwitchCondition {
  type: 'switch';
  id: number;
}

export interface VariableCondition {
  type: 'variable';
  id: number;
  value: number;
}

export interface RecipeCondition {
  type: 'recipe';
  key: string;
}

export interface OperatorCondition {
  operator: 'and' | 'or';
  conditions: Condition[];
}

export type SimpleCondition =
  | ManualCondition
  | SwitchCondition
  | VariableCondition
  | RecipeCondition;

export type Condition = SimpleCondition | OperatorCondition;

// ─── Recipe ──────────────────────────────────────────────────────────────────

export interface Recipe {
  ingredients: Record<string, number>;
  result: string;
  quantity: number;
  category: string;
  unlock_condition: Condition;
}

// ─── Category ────────────────────────────────────────────────────────────────

/** { categoryKey: textId } */
export type Category = Record<string, number>;

// ─── Config ──────────────────────────────────────────────────────────────────

export interface CraftingConfig {
  categories: Category[];
  data: Record<string, Recipe>;
}

// ─── Item ────────────────────────────────────────────────────────────────────

export interface GameItem {
  dbSymbol: string;
  name?: string;
  icon?: string;
  [key: string]: unknown;
}

// ─── App State ───────────────────────────────────────────────────────────────

export type Lang = 'en' | 'fr';
export type TabId = 'recipe' | 'cat' | 'json';

export type ToastType = 'ok' | 'err' | 'info' | 'warn';

export interface ToastEntry {
  id: string;
  message: string;
  type: ToastType;
}
