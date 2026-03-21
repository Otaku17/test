import type { Recipe } from '../types';

/**
 * Returns a list of validation errors for a recipe.
 * Rules:
 *  - Each ingredient quantity must be an integer >= 1.
 *  - If validItems is provided, each ingredient key must exist in that list.
 *  - If validItems is empty (no item data loaded), placeholder keys
 *    ("new_item", "new_item_N") are still flagged as invalid.
 */
export function getRecipeErrors(recipe: Recipe, validItems: string[]): string[] {
  const errors: string[] = [];

  for (const [item, qty] of Object.entries(recipe.ingredients ?? {})) {
    if (!qty || qty < 1 || !Number.isInteger(qty)) {
      errors.push(`"${item}" — quantity must be ≥ 1`);
    }

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
