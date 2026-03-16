import React from 'react';
import { useStore } from '../../store';
import { isRecipeValid } from '../../utils/validation';
import appIconUrl from '../../assets/icon.png';
import styles from './NavRail.module.css';

const RecipeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="13" y2="17"/>
  </svg>
);
const CatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const JsonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

type TabId = 'recipe' | 'cat' | 'json';

interface NavRailProps {
  activeTab: TabId;
  onTab: (id: TabId) => void;
  onDashboard: () => void;
  projectLoaded: boolean;
  dirtyRecipes: number;
  csvDirty: boolean;
}

export const NavRail: React.FC<NavRailProps> = ({
  activeTab, onTab, onDashboard, projectLoaded, dirtyRecipes, csvDirty,
}) => {
  const {
    theme, setTheme, saveAll, dirty,
    csvDirty: storeCsvDirty, dirtyKeys, config, items,
  } = useStore();

  const validItems = items.length > 0 ? items.map((i: any) => i.dbSymbol) : [];
  const allDirtyValid = [...dirtyKeys].every((key: string) => {
    const recipe = config.data[key];
    return recipe ? isRecipeValid(recipe, validItems) : true;
  });
  const hasUnsaved = dirty || storeCsvDirty;
  const canSave = hasUnsaved && allDirtyValid;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; dot?: boolean }[] = [
    { id: 'recipe', label: 'Recipes',    icon: <RecipeIcon />, dot: dirtyRecipes > 0 },
    { id: 'cat',    label: 'Categories', icon: <CatIcon />,    dot: csvDirty },
    { id: 'json',   label: 'JSON',       icon: <JsonIcon /> },
  ];

  return (
    <nav className={styles.nav}>

      {/* ── App icon — clique → dashboard */}
      <button className={styles.iconBtn} onClick={onDashboard} title="Back to dashboard">
        <img src={appIconUrl} alt="Crafting Editor" className={styles.appIconImg} />
      </button>

      <div className={styles.divider} />

      {/* ── Section tabs */}
      <div className={styles.items}>
        {tabs.map(({ id, label, icon, dot }) => (
          <button
            key={id}
            className={`${styles.item} ${activeTab === id && projectLoaded ? styles.itemActive : ''}`}
            onClick={() => projectLoaded && onTab(id)}
            disabled={!projectLoaded}
          >
            <span className={styles.itemIcon}>{icon}</span>
            <span className={styles.itemLabel}>{label}</span>
            {dot && <span className={styles.dot} />}
          </button>
        ))}
      </div>

      <div className={styles.spacer} />

      {/* ── Bottom controls */}
      <div className={styles.bottom}>
        <div className={styles.divider} />

        {/* Save */}
        <button
          className={`${styles.item} ${canSave ? styles.itemSave : ''}`}
          onClick={saveAll}
          disabled={!canSave}
          title={!allDirtyValid ? 'Fix invalid recipes first' : canSave ? 'Save all changes' : 'All saved'}
        >
          <span className={styles.itemIcon}><SaveIcon /></span>
          <span className={styles.itemLabel}>{hasUnsaved ? 'Save all' : 'Saved'}</span>
          {hasUnsaved && <span className={`${styles.dot} ${styles.dotSave}`} />}
        </button>

        {/* Theme */}
        <button
          className={styles.item}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span className={styles.itemIcon}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </span>
          <span className={styles.itemLabel}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

      </div>

    </nav>
  );
};
