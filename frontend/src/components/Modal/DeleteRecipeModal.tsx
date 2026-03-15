import React from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import styles from './Modal.module.css';
import dStyles from './DeleteRecipeModal.module.css';

interface DeleteRecipeModalProps {
  recipeKey: string | null;
  onClose: () => void;
}

/** Recursively collect all recipe-condition keys referenced in a condition tree */
function collectRecipeRefs(cond: any): string[] {
  if (!cond) return [];
  if (cond.type === 'recipe') return [cond.key];
  if (cond.operator && Array.isArray(cond.conditions)) {
    return cond.conditions.flatMap(collectRecipeRefs);
  }
  return [];
}

/** Remove all references to `targetKey` from a condition tree.
 *  Returns null if the whole node should be removed. */
function pruneCondition(cond: any, targetKey: string): any {
  if (!cond) return cond;
  if (cond.type === 'recipe') return cond.key === targetKey ? null : cond;
  if (cond.operator && Array.isArray(cond.conditions)) {
    const next = cond.conditions
      .map((c: any) => pruneCondition(c, targetKey))
      .filter((c: any) => c !== null);
    return { ...cond, conditions: next };
  }
  return cond;
}

export const DeleteRecipeModal: React.FC<DeleteRecipeModalProps> = ({ recipeKey, onClose }) => {
  const { config, deleteRecipe, updateRecipeField, itemNames } = useStore();

  if (!recipeKey) return null;

  // Find every other recipe that references recipeKey in its unlock_condition
  const dependents = Object.entries(config.data)
    .filter(([k, r]) => k !== recipeKey && collectRecipeRefs(r.unlock_condition).includes(recipeKey))
    .map(([k]) => k);

  const displayName = itemNames[recipeKey] ?? recipeKey;

  const handleDelete = () => {
    // Remove the recipe key from all conditions that reference it
    for (const depKey of dependents) {
      const recipe = config.data[depKey];
      const pruned = pruneCondition(recipe.unlock_condition, recipeKey);
      // If whole condition became empty operator, replace with manual true
      const next = (pruned?.operator && pruned.conditions?.length === 0)
        ? { type: 'manual', value: true }
        : (pruned ?? { type: 'manual', value: true });
      updateRecipeField(depKey, 'unlock_condition', next);
    }
    deleteRecipe(recipeKey);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h3>Delete recipe</h3>

        {dependents.length === 0 ? (
          <p className={styles.desc}>
            Are you sure you want to delete <strong>{displayName}</strong>? This cannot be undone.
          </p>
        ) : (
          <>
            <p className={styles.desc}>
              <strong>{displayName}</strong> is referenced in the unlock conditions of {dependents.length} other recipe{dependents.length > 1 ? 's' : ''}.
              Deleting it will remove those references automatically.
            </p>
            <div className={dStyles.depList}>
              {dependents.map((k) => (
                <div key={k} className={dStyles.depItem}>
                  <span className={dStyles.depName}>{itemNames[k] ?? k}</span>
                  <span className={dStyles.depKey}>{k}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>
            {dependents.length > 0 ? `Delete & clean ${dependents.length} condition${dependents.length > 1 ? 's' : ''}` : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
};
