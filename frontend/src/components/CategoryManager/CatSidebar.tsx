import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { getCatColorVars } from '../../utils/catColors';
import styles from './CatSidebar.module.css';

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

function ColorBadge({ catKey, label }: { catKey: string; label?: string }) {
  const [vars, setVars] = useState(() => getCatColorVars(catKey));

  useEffect(() => {
    setVars(getCatColorVars(catKey));
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.key === catKey)
        setVars(getCatColorVars(catKey));
    };
    window.addEventListener('catColorChanged', handler);
    return () => window.removeEventListener('catColorChanged', handler);
  }, [catKey]);

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 'var(--radius-xs)',
      border: `1px solid ${vars.border}`,
      background: vars.bg, color: vars.text,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label ?? catKey}
    </span>
  );
}

interface CatSidebarProps {
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAdd: () => void;
}

export const CatSidebar: React.FC<CatSidebarProps> = ({ selectedKey, onSelect, onAdd }) => {
  const { config, csvLines, csvDirty } = useStore();
  const [filter, setFilter] = useState('');

  const getEnName = (id: number): string => {
    const lineIdx = id + 1;
    if (!csvLines[lineIdx]) return '';
    const line = csvLines[lineIdx];
    const cols: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    return cols[0]?.replace(/^"|"$/g, '') ?? '';
  };

  const allCategories = config.categories || [];
  const allCat   = allCategories.find(obj => Object.keys(obj)[0] === 'all');
  const userCats = allCategories.filter(obj => Object.keys(obj)[0] !== 'all');

  const filtered = filter
    ? userCats.filter(obj => {
        const key  = Object.keys(obj)[0];
        const id   = Object.values(obj)[0] as number;
        return key.toLowerCase().includes(filter.toLowerCase()) ||
               getEnName(id).toLowerCase().includes(filter.toLowerCase());
      })
    : userCats;

  const renderItem = (obj: Record<string, number>, isAllCat = false) => {
    const key     = Object.keys(obj)[0];
    const id      = Object.values(obj)[0] as number;
    const enName  = getEnName(id);
    const isActive = selectedKey === key;

    return (
      <div key={key}
        className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
        onClick={() => onSelect(key)}
      >
        <ColorBadge catKey={key} />
        <span className={`${styles.enName} ${isActive ? styles.enNameActive : ''}`}>
          {enName || (isAllCat ? 'Default' : '')}
        </span>
      </div>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <span className={styles.headTitle}>Categories</span>
        <span className={styles.count}>{userCats.length}</span>
        {csvDirty && <span className={styles.dirtyDot} title="Unsaved CSV changes" />}
      </div>

      <div className={styles.search}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input type="text" className={styles.searchInput} placeholder="Filter…"
          value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      <div className={styles.list}>
        {allCat && renderItem(allCat as Record<string, number>, true)}
        {allCat && <div className={styles.divider} />}
        {filtered.length === 0 && !filter && userCats.length === 0 && (
          <div className={styles.empty}>No categories yet</div>
        )}
        {filtered.length === 0 && filter && <div className={styles.empty}>No results</div>}
        {filtered.map(obj => renderItem(obj as Record<string, number>))}
      </div>

      <div className={styles.foot}>
        <button className={styles.newBtn} onClick={onAdd}>
          <PlusIcon /><span>New category</span>
        </button>
      </div>
    </aside>
  );
};
