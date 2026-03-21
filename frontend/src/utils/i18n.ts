import type { Lang } from '../types';

type Translations = Record<string, string>;

// ── English ───────────────────────────────────────────────────────────────────

const EN: Translations = {
  // Nav / general
  open_project:    'Open project',
  save_all:        'Save all',
  new_recipe:      'New recipe',
  recipes:         'Recipes',
  // Empty states
  empty_sel_title: 'Select a recipe',
  empty_sel_desc:  'Choose a recipe on the left or create a new one.',
  // New recipe modal
  nr_title:        'New recipe',
  nr_desc:         "Select the result item. The recipe key will be the item's dbSymbol.",
  nr_item:         'Result item (dbSymbol)',
  nr_cat:          'Category',
  nr_qty:          'Quantity produced',
  key_prev:        'Recipe key:',
  cancel:          'Cancel',
  create:          'Create & Save',
  // Sidebar
  filter_ph:       'Filter...',
  // Recipe editor
  ingredients:     'Ingredients',
  add_ingr:        'Add',
  unlock_cond:     'Unlock condition',
  result_lbl:      'Result (item)',
  qty_lbl:         'Quantity',
  cat_lbl:         'Category',
  save:            'Save',
  delete:          'Delete',
  // Condition values
  unlocked:        'Unlocked',
  locked:          'Locked',
  no_cond:         'No conditions yet.',
  id_lbl:          'ID',
  value_lbl:       'Value',
  // Category confirm
  confirm_del_cat: 'Delete category "{k}"?',
};

// ── French ────────────────────────────────────────────────────────────────────

const FR: Translations = {
  open_project:    'Ouvrir projet',
  save_all:        'Tout sauvegarder',
  new_recipe:      'Nouvelle recette',
  recipes:         'Recettes',
  empty_sel_title: 'Sélectionnez une recette',
  empty_sel_desc:  'Choisissez une recette à gauche ou créez-en une nouvelle.',
  nr_title:        'Nouvelle recette',
  nr_desc:         "Sélectionnez l'item résultat. La clé sera le dbSymbol de l'item.",
  nr_item:         'Item résultat (dbSymbol)',
  nr_cat:          'Catégorie',
  nr_qty:          'Quantité produite',
  key_prev:        'Clé de la recette :',
  cancel:          'Annuler',
  create:          'Créer & Sauvegarder',
  filter_ph:       'Filtrer...',
  ingredients:     'Ingrédients',
  add_ingr:        'Ajouter',
  unlock_cond:     'Condition de déverrouillage',
  result_lbl:      'Résultat (item)',
  qty_lbl:         'Quantité',
  cat_lbl:         'Catégorie',
  save:            'Sauvegarder',
  delete:          'Supprimer',
  unlocked:        'Déverrouillé',
  locked:          'Verrouillé',
  no_cond:         'Aucune condition.',
  id_lbl:          'ID',
  value_lbl:       'Valeur',
  confirm_del_cat: 'Supprimer la catégorie "{k}" ?',
};

// ── Lookup ────────────────────────────────────────────────────────────────────

const MAP: Record<Lang, Translations> = { en: EN, fr: FR };

export function t(lang: Lang, key: string, vars?: Record<string, string>): string {
  let s = MAP[lang][key] ?? MAP.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}
