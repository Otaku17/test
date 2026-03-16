import React from 'react';
import { useStore } from '../../store';
import { getModeBadge, getModeBadgeClass } from '../../utils/appMode';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  onManageCategories?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = () => {
  const {
    projectName, projectIconUrl,
    lang, config, items, csvTexts,
  } = useStore();

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

      {/* Mode badge */}
      <span className={`${styles.pwaBadge} ${styles[`badge_${modeCls}`]}`}>
        {modeBadge}
      </span>
    </header>
  );
};

