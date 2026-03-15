import React from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import { SearchSelect } from '../layout/Form';
import { isRecipeValid } from '../../utils/validation';
import styles from './IngredientsEditor.module.css';

const MAX_INGREDIENTS = 4;

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface Props { recipeKey: string; }

export const IngredientsEditor: React.FC<Props> = ({ recipeKey }) => {
  const { lang, config, items, itemIcons, itemNames, deleteIngredient, updateIngredient, addIngredient } = useStore();
  const recipe = config.data[recipeKey];
  const ingr = recipe?.ingredients ?? {};

  const itemOptions = React.useMemo(() => {
    if (items.length > 0) return items.map((i) => i.dbSymbol);
    const extra = new Set<string>();
    Object.values(config.data).forEach((r) => {
      if (r.result) extra.add(r.result);
      Object.keys(r.ingredients || {}).forEach((k) => extra.add(k));
    });
    return [...extra].sort();
  }, [items, config.data]);

  const validItems = items.length > 0 ? items.map((i) => i.dbSymbol) : itemOptions;

  const entries = Object.entries(ingr);
  const slots = Array.from({ length: MAX_INGREDIENTS }, (_, i) => entries[i] ?? null);

  return (
    <div className={styles.root}>
      {slots.map((entry, idx) => {
        if (entry === null) {
          const isNext = entries.length === idx;
          return (
            <div
              key={`empty-${idx}`}
              className={`${styles.slot} ${styles.slotEmpty}`}
              style={!isNext ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' } : undefined}
              onClick={isNext ? () => addIngredient(recipeKey) : undefined}
            >
              <PlusIcon />
              <span className={styles.addLabel}>{t(lang, 'add_ingr')}</span>
            </div>
          );
        }

        const [item, qty] = entry;
        const iconUrl = itemIcons?.[item];
        const isInvalidItem = validItems.length > 0
          ? !validItems.includes(item)
          : /^new_item(_\d+)?$/.test(item);
        const isInvalidQty = !qty || qty < 1;
        const isInvalid = isInvalidItem || isInvalidQty;

        return (
          <div key={item} className={`${styles.slot} ${styles.slotFilled} ${isInvalid ? styles.slotInvalid : ''}`}>
            {/* Header : index + icône + nom + bouton supprimer */}
            <div className={styles.slotHeader}>
              <span className={styles.slotNum}>#{idx + 1}</span>
              {iconUrl
                ? <img src={iconUrl} alt="" className={styles.itemIcon} />
                : <div className={styles.itemIconPlaceholder} />
              }
              <span className={styles.itemName}>{itemNames[item] ?? item}</span>
              <button
                className={styles.removeBtn}
                onClick={() => deleteIngredient(recipeKey, item)}
                title="Remove"
              >
                <XIcon />
              </button>
            </div>

            {/* Corps : select + qty */}
            <div className={styles.slotBody}>
              <SearchSelect
                compact
                fullWidth
                showTriggerIcon={false}
                className={styles.itemSelect}
                value={item}
                onChange={(e) => updateIngredient(recipeKey, item, e.target.value, null)}
                placeholder="Search…"
                icons={itemIcons}
                names={itemNames}
              >
                {itemOptions.length === 0 && <option value={item}>{item}</option>}
                {itemOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </SearchSelect>

              <div className={styles.qtyRow}>
                <span className={styles.qtyLabel}>Quantity</span>
                <input
                  className={styles.qtyInput}
                  type="number"
                  value={qty}
                  min={1}
                  onChange={(e) => updateIngredient(recipeKey, item, null, parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
