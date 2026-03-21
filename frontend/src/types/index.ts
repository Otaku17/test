// ── Condition types ───────────────────────────────────────────────────────────

export type ConditionType =
  | 'manual'
  | 'switch'
  | 'variable'
  | 'recipe'
  | 'quest'
  | 'operator';

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

export interface QuestCondition {
  type: 'quest';
  key: string;
}

/**
 * Operator condition supporting AND, OR, and NOT logic.
 * - AND / OR: hold multiple children in `conditions[]`.
 * - NOT:      holds a single inner condition in `condition`.
 */
export interface OperatorCondition {
  operator: 'and' | 'or' | 'not';
  conditions?: Condition[]; // and / or
  condition?:  Condition;   // not
}

export type NotCondition = OperatorCondition & { operator: 'not'; condition: Condition };

export type SimpleCondition =
  | ManualCondition
  | SwitchCondition
  | VariableCondition
  | RecipeCondition
  | QuestCondition;

export type Condition = SimpleCondition | OperatorCondition;

// ── Recipe ───────────────────────────────────────────────────────────────────

export interface Recipe {
  ingredients:      Record<string, number>;
  result:           string;
  quantity:         number;
  category:         string;
  unlock_condition: Condition;
}

// ── Category ─────────────────────────────────────────────────────────────────

/** Shape: { categoryKey: textId } */
export type Category = Record<string, number>;

// ── Config ───────────────────────────────────────────────────────────────────

export interface CraftingConfig {
  categories: Category[];
  data:        Record<string, Recipe>;
}

// ── Game data ─────────────────────────────────────────────────────────────────

export interface GameItem {
  dbSymbol: string;
  name?:    string;
  icon?:    string;
  [key: string]: unknown;
}

export interface GameQuest {
  dbSymbol: string;
  id:       number;
  [key: string]: unknown;
}

// ── App state ─────────────────────────────────────────────────────────────────

export type Lang    = 'en' | 'fr';
export type TabId   = 'recipe' | 'cat' | 'json';

export type ToastType = 'ok' | 'err' | 'info' | 'warn';

export interface ToastEntry {
  id:      string;
  message: string;
  type:    ToastType;
}
