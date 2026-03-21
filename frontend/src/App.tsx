import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { NavRail } from './components/NavRail/NavRail';
import { Sidebar } from './components/Sidebar/Sidebar';
import { CatSidebar } from './components/CategoryManager/CatSidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { RecipeEditor } from './components/RecipeEditor/RecipeEditor';
import { CategoryManager } from './components/CategoryManager/CategoryManager';
import { JsonViewer } from './components/JsonViewer/JsonViewer';
import { NewRecipeModal } from './components/Modal/NewRecipeModal';
import { NewCategoryModal } from './components/Modal/NewCategoryModal';
import { MissingFilesModal } from './components/Modal/MissingFilesModal';
import { UpdateBanner } from './components/layout/UpdatePrompt';
import { ToastContainer } from './components/Toast/Toast';
import { UnsavedModal } from './components/Modal/UnsavedModal';
import styles from './App.module.css';
import { TabId } from './types';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    saveAll,
    configHandle,
    projectName,
    openProject,
    dirtyKeys,
    csvDirty,
    missingFilesWarnings,
    missingFilesOpen,
    closeMissingFiles,
    loading,
    loadingStep,
    deleteCategory,
  } = useStore();

  const [newRecipeOpen, setNewRecipeOpen] = useState(false);
  const [selectedCatKey, setSelectedCatKey] = useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const projectLoaded = !!configHandle || !!projectName;

  // Quand un projet se charge, quitter le dashboard automatiquement
  // Quand il est déchargé, y revenir
  useEffect(() => {
    if (projectLoaded) setShowDashboard(false);
    else setShowDashboard(true);
  }, [projectLoaded]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (projectLoaded) saveAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openProject();
      }
      if (e.key === 'Escape') {
        setNewRecipeOpen(false);
        setNewCatOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [projectLoaded]);

  const handleDeleteCategory = (key: string, idx: number) => {
    deleteCategory(idx);
    setSelectedCatKey(null);
  };

  const handleRenameCategory = (newKey: string) => {
    setSelectedCatKey(newKey);
  };

  return (
    <div className={styles.app}>
      <div className={styles.body}>
        {/* ── Nav rail — visible seulement si projet chargé */}
        {projectLoaded && (
          <NavRail
            activeTab={activeTab as TabId}
            onTab={(id) => {
              setShowDashboard(false);
              setActiveTab(id);
              if (id === 'cat' && !selectedCatKey) {
                const firstCat = useStore.getState().config.categories[0];
                if (firstCat) setSelectedCatKey(Object.keys(firstCat)[0]);
              }
            }}
            onDashboard={() => setShowDashboard(true)}
            projectLoaded={projectLoaded}
            dirtyRecipes={dirtyKeys.size}
            csvDirty={csvDirty}
          />
        )}

        {/* ── Sidebar secondaire — masquée sur dashboard */}
        {projectLoaded && !showDashboard && activeTab === 'recipe' && (
          <Sidebar onNewRecipe={() => setNewRecipeOpen(true)} />
        )}
        {projectLoaded && !showDashboard && activeTab === 'cat' && (
          <CatSidebar
            selectedKey={selectedCatKey}
            onSelect={(key) => setSelectedCatKey(key)}
            onAdd={() => setNewCatOpen(true)}
          />
        )}

        {/* ── Contenu principal */}
        <main className={styles.main}>
          {!projectLoaded || showDashboard ? (
            <Dashboard onOpen={() => setShowDashboard(false)} />
          ) : (
            <div className={styles.panels}>
              {activeTab === 'recipe' && <RecipeEditor />}
              {activeTab === 'cat' && (
                <CategoryManager
                  selectedKey={selectedCatKey}
                  onDeleteCategory={handleDeleteCategory}
                  onRenameCategory={handleRenameCategory}
                  showAddForm={false}
                  onCloseAddForm={function (): void {
                    throw new Error('Function not implemented.');
                  }}
                />
              )}
              {activeTab === 'json' && <JsonViewer />}
            </div>
          )}
        </main>
      </div>

      {loading && loadingStep && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingProgressBar}>
              <div
                className={styles.loadingProgressFill}
                style={{
                  width: `${(loadingStep.current / loadingStep.total) * 100}%`,
                }}
              />
            </div>
            <span className={styles.loadingText}>{loadingStep.label}</span>
            <span className={styles.loadingCounter}>
              {loadingStep.current} / {loadingStep.total}
            </span>
          </div>
        </div>
      )}

      {!projectLoaded && <UpdateBanner />}
      <ToastContainer />
      <UnsavedModal />
      <NewRecipeModal
        open={newRecipeOpen}
        onClose={() => setNewRecipeOpen(false)}
      />
      <NewCategoryModal
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        onCreated={(key) => setSelectedCatKey(key)}
      />
      <MissingFilesModal
        open={missingFilesOpen}
        warnings={missingFilesWarnings}
        onClose={closeMissingFiles}
      />
    </div>
  );
};
