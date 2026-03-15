import React from 'react';
import { useStore } from '../../store';
import { useInstallPrompt } from '../layout/UpdatePrompt';
import { isRecipeValid } from '../../utils/validation';
import { getModeBadge, getModeBadgeClass } from '../../utils/appMode';
import styles from './TitleBar.module.css';

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const SaveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);

export const TitleBar: React.FC = () => {
  const { projectName, projectIconUrl, configHandle, dirty, saveAll, theme, setTheme, config, dirtyKeys, items } = useStore();
  const { canInstall, install } = useInstallPrompt();
  const projectLoaded = !!configHandle || !!projectName;

  const validItems = items.length > 0 ? items.map((i) => i.dbSymbol) : [];
  const allDirtyValid = [...dirtyKeys].every((key) => {
    const recipe = config.data[key];
    return recipe ? isRecipeValid(recipe, validItems) : true;
  });
  const canSave = dirty && allDirtyValid;
  const modeBadge = getModeBadge();
  const modeCls   = getModeBadgeClass();

  return (
    <header className={styles.titlebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          {projectIconUrl
            ? <img src={projectIconUrl} alt="" className={styles.brandProjectIcon} />
            : <div className={styles.brandSquare} />
          }
        </div>
        <span className={styles.brandName}>Crafting Editor</span>
      </div>

      {projectName && (
        <>
          <div className={styles.divider} />
          <div className={styles.project}>
            <span className={styles.projectName}>{projectName}</span>
          </div>
        </>
      )}

      <div className={styles.spacer} />

      {projectLoaded && (
        <button
          className={`${styles.saveBtn} ${canSave ? styles.saveBtnDirty : ''}`}
          onClick={saveAll}
          disabled={!canSave}
          title={!allDirtyValid ? 'Fix invalid ingredients before saving' : canSave ? 'Save all changes' : 'All saved'}
        >
          <SaveIcon />
          <span>{dirty ? 'Save all' : 'Saved'}</span>
        </button>
      )}

      <button className={styles.themeBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Badge APP vert */}
      <span className={`${styles.pwaBadge} ${styles[`badge_${modeCls}`]}`}>{modeBadge}</span>
    </header>
  );
};
