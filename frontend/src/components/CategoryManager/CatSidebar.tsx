import React from 'react';
import { useStore } from '../../store';
import { Badge, catVariant } from '../layout/Badge';
import { t } from '../../utils/i18n';
import styles from './CatSidebar.module.css';

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

interface CatSidebarProps {
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAdd: () => void;
}

export const CatSidebar: React.FC<CatSidebarProps> = ({ selectedKey, onSelect, onAdd }) => {
  const { lang, config, csvLines, csvDirty } = useStore();

  // Récupérer le nom EN de chaque catégorie depuis le CSV
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
    return cols[0] ?? '';
  };

  const categories = config.categories || [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <span className={styles.headTitle}>Categories</span>
        <span className={styles.count}>{categories.length}</span>
        {csvDirty && <span className={styles.dirtyDot} title="Unsaved CSV changes" />}
      </div>

      <div className={styles.list}>
        {categories.length === 0 && (
          <div className={styles.empty}>No categories</div>
        )}
        {categories.map(obj => {
          const key = Object.keys(obj)[0];
          const id = Object.values(obj)[0] as number;
          const enName = getEnName(id);
          const isActive = selectedKey === key;

          return (
            <button
              key={key}
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => onSelect(key)}
            >
              <Badge variant={catVariant(key)}>{key}</Badge>
              {enName && <span className={styles.enName}>{enName}</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.foot}>
        <button className={styles.newBtn} onClick={onAdd}>
          <PlusIcon />
          <span>New category</span>
        </button>
      </div>
    </aside>
  );
};
