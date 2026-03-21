import React from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import { Button } from '../layout/Button';
import { FormGroup, Select, SearchSelect, Input } from '../layout/Form';
import { IngredientsEditor } from './IngredientsEditor';
import { DeleteRecipeModal } from '../Modal/DeleteRecipeModal';
import { ConditionEditor } from './ConditionEditor';
import { isRecipeValid } from '../../utils/validation';
import styles from './RecipeEditor.module.css';
import type { OperatorCondition, SimpleCondition } from '../../types';

// Small inline component so RecipeEditor doesn't need to know about condition internals
const ConditionTypeSelect: React.FC<{ recipeKey: string }> = ({
  recipeKey,
}) => {
  const { config, setRootCondition } = useStore();
  const cond = config.data[recipeKey]?.unlock_condition;
  const condType = (cond as OperatorCondition)?.operator
    ? 'operator'
    : ((cond as SimpleCondition)?.type ?? 'manual');
  return (
    <Select
      compact
      fullWidth={false}
      style={{ width: 'auto', flexShrink: 0 }}
      value={condType}
      onChange={(e) => setRootCondition(recipeKey, e.target.value)}
    >
      {['manual', 'switch', 'variable', 'recipe', 'quest', 'operator'].map(
        (x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ),
      )}
    </Select>
  );
};

const ListIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const DiscardIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const CopyIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const RecipeEditor: React.FC = () => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const {
    lang,
    config,
    currentKey,
    dirtyKeys,
    saveRecipe,
    discardRecipe,
    renameRecipe,
    updateRecipeField,
    items,
    itemIcons,
    itemNames,
    addToast,
  } = useStore();
  if (!currentKey)
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <ListIcon />
        </div>
        <h3>{t(lang, 'empty_sel_title')}</h3>
        <p dangerouslySetInnerHTML={{ __html: t(lang, 'empty_sel_desc') }} />
      </div>
    );

  const recipe = config.data[currentKey];
  if (!recipe) return null;

  const itemOptions =
    items.length > 0
      ? items.map((i) => i.dbSymbol)
      : (() => {
          const extra = new Set<string>();
          Object.values(config.data).forEach((r) => {
            if (r.result) extra.add(r.result);
            Object.keys(r.ingredients || {}).forEach((k) => extra.add(k));
          });
          return [...extra].sort();
        })();

  const catOptions = (config.categories || [])
    .map((c) => Object.keys(c)[0])
    .filter((k) => k !== 'all');

  const validItems =
    items.length > 0 ? items.map((i) => i.dbSymbol) : itemOptions;
  const recipeValid = isRecipeValid(recipe, validItems);
  const canSave = dirtyKeys.has(currentKey) && recipeValid;

  return (
    <div className={styles.editor}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {itemIcons[currentKey] && (
            <img
              src={itemIcons[currentKey]}
              className={styles.recipeIcon}
              alt=""
            />
          )}
          <div className={styles.recipeTitle}>
            <h2 className={styles.recipeKey}>
              {itemNames[currentKey] ?? currentKey}
            </h2>
            <button
              className={styles.dbSymbolBadge}
              onClick={async () => {
                // Wails runtime clipboard si disponible, sinon navigator.clipboard
                const wailsClip =
                  (window as any)?.runtime?.ClipboardSetText ??
                  (window as any)?.go?.runtime?.ClipboardSetText;
                if (typeof wailsClip === 'function') {
                  await wailsClip(`:${currentKey}`);
                } else {
                  await navigator.clipboard
                    .writeText(`:${currentKey}`)
                    .catch(() => {});
                }
                addToast(`Copied: :${currentKey}`, 'info');
              }}
              title="Click to copy db_symbol"
            >
              <CopyIcon />
              {currentKey}
            </button>
          </div>
          {dirtyKeys.has(currentKey) && (
            <span className={styles.dirtyBadge}>Unsaved</span>
          )}
        </div>
        <div className={styles.headerActions}>
          {dirtyKeys.has(currentKey) && (
            <Button
              variant="warn"
              size="sm"
              onClick={() => discardRecipe(currentKey)}
            >
              <DiscardIcon /> Discard
            </Button>
          )}
          <Button
            variant="success"
            size="sm"
            onClick={() => saveRecipe(currentKey)}
            disabled={!canSave}
            title={
              !recipeValid ? 'Fix invalid ingredients before saving' : undefined
            }
          >
            {t(lang, 'save')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteOpen(true);
            }}
          >
            {t(lang, 'delete')}
          </Button>
        </div>
      </div>

      {/* Base fields */}
      <div className={styles.fieldRow}>
        <FormGroup label={t(lang, 'result_lbl')}>
          <SearchSelect
            
            value={recipe.result}
            onChange={(e) => {
              renameRecipe(currentKey, e.target.value);
            }}
            placeholder="Search items…"
            icons={itemIcons}
            names={itemNames}
            showTriggerIcon={false}
          >
            {itemOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SearchSelect>
        </FormGroup>
        <FormGroup label={t(lang, 'qty_lbl')}>
          <Input
            type="number"
            value={recipe.quantity ?? 1}
            min={1}
            onChange={(e) =>
              updateRecipeField(
                currentKey,
                'quantity',
                parseInt(e.target.value),
              )
            }
          />
        </FormGroup>
        <FormGroup label={t(lang, 'cat_lbl')}>
          <Select
            value={recipe.category ?? 'all'}
            onChange={(e) =>
              updateRecipeField(currentKey, 'category', e.target.value)
            }
          >
            {catOptions.length === 0 ? (
              <option value="" disabled>
                No categories
              </option>
            ) : (
              catOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))
            )}
          </Select>
        </FormGroup>
      </div>

      {/* Ingredients */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span
            className={styles.sectionDot}
            style={{ background: 'var(--accent)' }}
          />
          <span className={styles.sectionTitle}>{t(lang, 'ingredients')}</span>
        </div>
        <div className={styles.sectionBody}>
          <IngredientsEditor recipeKey={currentKey} />
        </div>
      </div>

      {/* Unlock condition */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span
            className={styles.sectionDot}
            style={{ background: 'var(--yellow)' }}
          />
          <span className={styles.sectionTitle}>{t(lang, 'unlock_cond')}</span>
          <ConditionTypeSelect recipeKey={currentKey} />
        </div>
        <div className={styles.sectionBody}>
          <ConditionEditor recipeKey={currentKey} />
        </div>
      </div>
      <DeleteRecipeModal
        recipeKey={deleteOpen ? currentKey : null}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
};
