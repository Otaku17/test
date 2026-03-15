import React, { useState } from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import { Badge, catVariant } from '../layout/Badge';
import styles from './Sidebar.module.css';

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const DiscardIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

interface SidebarProps {
  onNewRecipe: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewRecipe }) => {
  const { lang, config, configHandle, projectName, currentKey, dirtyKeys, discardRecipe, setCurrentKey, setActiveTab, itemNames, itemIcons } = useStore();
  const projectLoaded = !!configHandle || !!projectName;
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allKeys = Object.keys(config.data);

  const filtered = filter
    ? allKeys.filter((k) => {
        const r = config.data[k];
        return (
          k.toLowerCase().includes(filter.toLowerCase()) ||
          (r.category || '').toLowerCase().includes(filter.toLowerCase())
        );
      })
    : allKeys;

  const groups: Record<string, string[]> = {};
  for (const key of filtered) {
    const cat = config.data[key].category;
    const group = (!cat || cat === '__undef__') ? 'uncategorized' : cat;
    if (!groups[group]) groups[group] = [];
    groups[group].push(key);
  }
  const sortedCats = Object.keys(groups).sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    if (a === 'uncategorized') return 1;
    if (b === 'uncategorized') return -1;
    return a.localeCompare(b);
  });

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const openRecipe = (key: string) => {
    setCurrentKey(key);
    setActiveTab('recipe');
  };

  const handleDiscard = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    discardRecipe(key);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.head}>
        <span className={styles.headTitle}>{t(lang, 'recipes')}</span>
        <span className={styles.count}>{allKeys.length}</span>
        {dirtyKeys.size > 0 && (
          <span className={styles.dirtyCount} title={`${dirtyKeys.size} unsaved`}>
            {dirtyKeys.size}
          </span>
        )}
      </div>

      {/* Search */}
      <div className={styles.search}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t(lang, 'filter_ph')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Grouped list */}
      <div className={styles.list}>
        {filtered.length === 0 && (
          <div className={styles.empty}>No results</div>
        )}

        {sortedCats.map((cat) => {
          const keys = groups[cat];
          const isOpen = !collapsed.has(cat);
          const dirtyInCat = keys.filter((k) => dirtyKeys.has(k)).length;

          return (
            <div key={cat} className={styles.group}>
              <button className={styles.groupHeader} onClick={() => toggleCollapse(cat)}>
                <span className={styles.chevron}><ChevronIcon open={isOpen} /></span>
                {cat === 'uncategorized'
                  ? <span className={styles.uncatLabel}>uncategorized</span>
                  : <Badge variant={catVariant(cat)}>{cat}</Badge>
                }
                <span className={styles.groupCount}>{keys.length}</span>
                {dirtyInCat > 0 && (
                  <span className={styles.groupDirty} title={`${dirtyInCat} unsaved`} />
                )}
              </button>

              {isOpen && (
                <div className={styles.groupItems}>
                  {keys.map((key) => {
                    const isDirty = dirtyKeys.has(key);
                    const isActive = key === currentKey;
                    return (
                      <div
                        key={key}
                        className={[
                          styles.item,
                          isActive ? styles.active : '',
                          isDirty ? styles.dirty : '',
                        ].join(' ')}
                        onClick={() => openRecipe(key)}
                      >
                        {isDirty && (
                          <span className={styles.dirtyDot} title="Unsaved changes" />
                        )}
                        {itemIcons[key] && <img src={itemIcons[key]} className={styles.itemIcon} alt="" />}<span className={styles.itemKey}>{itemNames[key] ?? key}</span>
                        {isDirty && (
                          <button
                            className={styles.discardBtn}
                            onClick={(e) => handleDiscard(e, key)}
                            title="Discard changes"
                          >
                            <DiscardIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={styles.foot}>
        <button className={styles.catBtn} onClick={onNewRecipe} disabled={!projectLoaded}>
          <span>{t(lang, 'new_recipe')}</span>
        </button>
      </div>
    </aside>
  );
};
