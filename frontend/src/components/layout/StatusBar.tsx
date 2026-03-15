import React from 'react';
import { useStore } from '../../store';
import styles from './StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const { projectName, items, config, csvTexts, configHandle } = useStore();
  const recipeCount = Object.keys(config.data).length;
  const csvCount = Object.keys(csvTexts).length;
  const projectLoaded = !!configHandle || !!projectName;

  return (
    <footer className={styles.bar}>
      {projectName && <span className={styles.item}>{projectName}</span>}
      {projectName && <span className={styles.sep}>|</span>}
      {projectLoaded && (
        <>
          <span className={styles.item}>{items.length} items</span>
          <span className={styles.sep}>|</span>
          <span className={styles.item}>{csvCount} CSV</span>
          <span className={styles.sep}>|</span>
          <span className={styles.item}>{recipeCount} recipes</span>
        </>
      )}
      <div className={styles.spacer} />
      <span className={styles.pwaTag}>PWA</span>
    </footer>
  );
};
