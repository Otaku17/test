import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { TitleBar } from './components/TitleBar/TitleBar';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RecipeEditor } from './components/RecipeEditor/RecipeEditor';
import { CategoryManager } from './components/CategoryManager/CategoryManager';
import { JsonViewer } from './components/JsonViewer/JsonViewer';
import { NewRecipeModal } from './components/Modal/NewRecipeModal';
import { MissingFilesModal } from './components/Modal/MissingFilesModal';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { ToastContainer } from './components/Toast/Toast';
import styles from './App.module.css';

const TABS = [
  { id: 'recipe' as const, label: 'Recipe' },
  { id: 'cat'    as const, label: 'Categories' },
  { id: 'json'   as const, label: 'JSON' },
];

export const App: React.FC = () => {
  const {
    activeTab, setActiveTab, saveAll,
    configHandle, projectName,
    openProject, dirty,
    missingFilesWarnings, missingFilesOpen, closeMissingFiles, loading,
  } = useStore();
  const [newRecipeOpen, setNewRecipeOpen] = useState(false);

  // configHandle est toujours null en desktop — projectName = projet chargé
  const projectLoaded = !!configHandle || !!projectName;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (projectLoaded) saveAll(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); openProject(); }
      if (e.key === 'Escape') setNewRecipeOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [projectLoaded]);

  return (
    <div className={styles.app}>
      {projectLoaded && <TitleBar />}
      {projectLoaded && <Toolbar onManageCategories={() => setActiveTab('cat')} />}

      <div className={styles.body}>
        {projectLoaded && <Sidebar onNewRecipe={() => setNewRecipeOpen(true)} />}

        <main className={styles.main}>
          {projectLoaded && (
            <div className={styles.tabs}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                  {id === 'recipe' && dirty && <span className={styles.tabDot} />}
                </button>
              ))}
            </div>
          )}

          <div className={styles.panels}>
            {activeTab === 'recipe' && <RecipeEditor />}
            {activeTab === 'cat'    && projectLoaded && <CategoryManager />}
            {activeTab === 'json'   && projectLoaded && <JsonViewer />}
          </div>
        </main>
      </div>

      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner} />
            <span className={styles.loadingText}>Loading project...</span>
          </div>
        </div>
      )}

      <UpdatePrompt />
      <ToastContainer />
      <NewRecipeModal open={newRecipeOpen} onClose={() => setNewRecipeOpen(false)} />
      <MissingFilesModal open={missingFilesOpen} warnings={missingFilesWarnings} onClose={closeMissingFiles} />
    </div>
  );
};
