import React from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import styles from './IngredientsEditor.module.css';

const MAX_INGREDIENTS = 4;

const XIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

interface Props {
  recipeKey: string;
}

export const IngredientsEditor: React.FC<Props> = ({ recipeKey }) => {
  const {
    lang,
    config,
    items,
    itemIcons,
    itemNames,
    deleteIngredient,
    updateIngredient,
    addIngredient,
  } = useStore();

  const recipe = config.data[recipeKey];
  const ingr = recipe?.ingredients ?? {};

  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const itemOptions = React.useMemo(() => {
    if (items.length > 0) return items.map((i) => i.dbSymbol);
    const extra = new Set<string>();
    Object.values(config.data).forEach((r) => {
      if (r.result) extra.add(r.result);
      Object.keys(r.ingredients || {}).forEach((k) => extra.add(k));
    });
    return [...extra].sort();
  }, [items, config.data]);

  const validItems =
    items.length > 0 ? items.map((i) => i.dbSymbol) : itemOptions;

  const entries = Object.entries(ingr);
  const slots = Array.from(
    { length: MAX_INGREDIENTS },
    (_, i) => entries[i] ?? null,
  );

  const filteredOptions = React.useMemo(
    () =>
      itemOptions.filter((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [itemOptions, searchQuery],
  );

  const openDd = (itemKey: string) => {
    setOpenDropdown(itemKey);
    setSearchQuery('');
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  const closeDd = () => {
    setOpenDropdown(null);
    setSearchQuery('');
  };

  React.useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        closeDd();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  return (
    <div className={styles.root}>
      {slots.map((entry, idx) => {
        if (entry === null) {
          const isNext = entries.length === idx;
          return (
            <div
              key={`empty-${idx}`}
              className={`${styles.row} ${styles.rowEmpty} ${!isNext ? styles.rowGhost : ''}`}
              onClick={isNext ? () => addIngredient(recipeKey) : undefined}
            >
              <span className={styles.rowNum}>#{idx + 1}</span>
              <div className={styles.emptyIconPlaceholder} />
              <span className={styles.emptyLabel}>
                <PlusIcon /> {t(lang, 'add_ingr')}
              </span>
            </div>
          );
        }

        const [item, qty] = entry;
        const iconUrl = itemIcons?.[item];
        const isInvalidItem =
          validItems.length > 0
            ? !validItems.includes(item)
            : /^new_item(_\d+)?$/.test(item);
        const isInvalidQty = !qty || qty < 1;
        const isInvalid = isInvalidItem || isInvalidQty;
        const isOpen = openDropdown === item;

        return (
          <div
            key={item}
            className={`${styles.row} ${styles.rowFilled} ${isInvalid ? styles.rowInvalid : ''}`}
          >
            <span className={styles.rowNum}>#{idx + 1}</span>

            {iconUrl ? (
              <img src={iconUrl} alt="" className={styles.itemIcon} />
            ) : (
              <div className={styles.itemIconPlaceholder} />
            )}

            <div
              className={styles.itemTriggerWrap}
              ref={isOpen ? dropdownRef : undefined}
            >
              <button
                className={`${styles.itemTrigger} ${isOpen ? styles.itemTriggerOpen : ''} ${isInvalidItem ? styles.itemTriggerInvalid : ''}`}
                onClick={() => (isOpen ? closeDd() : openDd(item))}
                type="button"
              >
                <span className={styles.itemTriggerLabel}>
                  {itemNames[item] ?? item}
                </span>
                <span className={styles.itemTriggerChevron}>
                  <ChevronIcon />
                </span>
              </button>

              {isOpen && (
                <div className={styles.dropdown}>
                  <input
                    ref={searchRef}
                    className={styles.dropdownSearch}
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && closeDd()}
                  />
                  <div className={styles.dropdownList}>
                    {filteredOptions.length === 0 && (
                      <div className={styles.dropdownEmpty}>No results</div>
                    )}
                    {filteredOptions.map((s) => (
                      <div
                        key={s}
                        className={`${styles.dropdownOption} ${s === item ? styles.dropdownOptionSelected : ''}`}
                        onMouseDown={() => {
                          updateIngredient(recipeKey, item, s, null);
                          closeDd();
                        }}
                      >
                        {itemIcons?.[s] && (
                          <img
                            src={itemIcons[s]}
                            alt=""
                            className={styles.dropdownOptionIcon}
                          />
                        )}
                        <span className={styles.dropdownOptionLabel}>
                          <span className={styles.dropdownOptionName}>
                            {itemNames[s] ?? s}
                          </span>
                          {itemNames[s] && (
                            <span className={styles.dropdownOptionSub}>
                              {s}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className={`${styles.stepper} ${isInvalidQty ? styles.stepperInvalid : ''}`}
            >
              <button
                className={styles.stepperBtn}
                onClick={() =>
                  updateIngredient(
                    recipeKey,
                    item,
                    null,
                    Math.max(1, (qty ?? 1) - 1),
                  )
                }
                type="button"
              >
                −
              </button>
              <span className={styles.stepperVal}>{qty ?? 1}</span>
              <button
                className={styles.stepperBtn}
                onClick={() =>
                  updateIngredient(recipeKey, item, null, (qty ?? 1) + 1)
                }
                type="button"
              >
                +
              </button>
            </div>

            <button
              className={styles.removeBtn}
              onClick={() => deleteIngredient(recipeKey, item)}
              title="Remove"
              type="button"
            >
              <XIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
};
