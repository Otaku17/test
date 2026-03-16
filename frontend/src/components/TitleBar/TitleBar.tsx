import React from 'react';
import { useStore } from '../../store';
import { useInstallPrompt } from '../layout/UpdatePrompt';
import { getModeBadge, getModeBadgeClass } from '../../utils/appMode';
import styles from './TitleBar.module.css';

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

interface TitleBarProps {
  onManageCategories?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = () => {
  const {
    projectName, projectIconUrl,
    lang, config, items, csvTexts,
  } = useStore();
  const { canInstall, install } = useInstallPrompt();

  const recipeCount = Object.keys(config.data).length;
  const modeBadge = getModeBadge();
  const modeCls   = getModeBadgeClass();

  return (
    <header className={styles.titlebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          {projectIconUrl
            ? <img src={projectIconUrl} alt="" className={styles.brandProjectIcon} />
            : <div className={styles.brandSquare} />
          }
        </div>
      </div>

      {projectName && (
        <>
          <div className={styles.divider} />
          <span className={styles.projectName}>{projectName}</span>
          <div className={styles.divider} />
          {/* Stats */}
          <div className={styles.stats}>
            <span className={styles.stat}><strong>{items.length}</strong> items</span>
            <span className={styles.statDot} />
            <span className={styles.stat}><strong>{recipeCount}</strong> recipes</span>
            <span className={styles.statDot} />
            <span className={styles.stat}><strong>{Object.keys(csvTexts).length}</strong> CSV</span>
          </div>
        </>
      )}

      <div className={styles.spacer} />

      {/* Install PWA */}
      {canInstall && (
        <button className={styles.installBtn} onClick={install} title="Install as desktop app">
          <DownloadIcon />
          <span>Install</span>
        </button>
      )}

      {/* Mode badge */}
      <span className={`${styles.pwaBadge} ${styles[`badge_${modeCls}`]}`}>
        {modeBadge}
      </span>
    </header>
  );
};
