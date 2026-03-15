import type { Recipe } from '../types';

/**
 * Vérifie qu'une recette est valide pour le save :
 * - Chaque ingrédient a une quantity >= 1
 * - Chaque clé d'ingrédient est un item valide (présent dans validItems)
 *   Si validItems est vide (pas de CSV chargé), on accepte tout sauf les clés
 *   générées automatiquement ("new_item", "new_item_X")
 */
export function getRecipeErrors(
  recipe: Recipe,
  validItems: string[]
): string[] {
  const errors: string[] = [];
  const entries = Object.entries(recipe.ingredients ?? {});

  for (const [item, qty] of entries) {
    // Qty invalide
    if (!qty || qty < 1 || !Number.isInteger(qty)) {
      errors.push(`"${item}" — quantity must be ≥ 1`);
    }

    // Item non valide
    if (validItems.length > 0 && !validItems.includes(item)) {
      errors.push(`"${item}" is not a valid item`);
    } else if (validItems.length === 0 && /^new_item(_\d+)?$/.test(item)) {
      errors.push(`Slot ${item} — please select an item`);
    }
  }

  return errors;
}

export function isRecipeValid(recipe: Recipe, validItems: string[]): boolean {
  return getRecipeErrors(recipe, validItems).length === 0;
}
