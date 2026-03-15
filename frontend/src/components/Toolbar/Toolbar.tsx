import React from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import { Button } from '../layout/Button';
import styles from './Toolbar.module.css';

const FolderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

interface ToolbarProps { onManageCategories: () => void; }

export const Toolbar: React.FC<ToolbarProps> = ({ onManageCategories }) => {
  const { lang, openProject, configHandle, projectName, items, csvTexts, config } = useStore();
  const recipeCount = Object.keys(config.data).length;
  const projectLoaded = !!configHandle || !!projectName;

  return (
    <div className={styles.toolbar}>
      <Button variant="ghost" onClick={openProject}>
        <FolderIcon />
        {t(lang, 'open_project')}
      </Button>

      <div className={styles.sep} />

      <Button variant="ghost" onClick={onManageCategories} disabled={!projectLoaded}>
        {t(lang, 'manage_cats')}
      </Button>

      <div className={styles.spacer} />

      {projectLoaded && (
        <div className={styles.stats}>
          <span className={styles.stat}><strong>{items.length}</strong> items</span>
          <span className={styles.statDot} />
          <span className={styles.stat}><strong>{recipeCount}</strong> recipes</span>
          <span className={styles.statDot} />
          <span className={styles.stat}><strong>{Object.keys(csvTexts).length}</strong> CSV</span>
        </div>
      )}
    </div>
  );
};
