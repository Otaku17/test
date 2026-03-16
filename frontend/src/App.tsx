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
import { MissingFilesModal } from './components/Modal/MissingFilesModal';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { ToastContainer } from './components/Toast/Toast';
import { UnsavedModal } from './components/Modal/UnsavedModal';
import styles from './App.module.css';

type TabId = 'recipe' | 'cat' | 'json';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    saveAll,
    configHandle,
    projectName,
    openProject,
    dirty,
    dirtyKeys,
    csvDirty,
    missingFilesWarnings,
    missingFilesOpen,
    closeMissingFiles,
    loading,
    addCategory,
    deleteCategory,
    openProjectPath,
  } = useStore();

  const [newRecipeOpen, setNewRecipeOpen] = useState(false);
  const [selectedCatKey, setSelectedCatKey] = useState<string | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const projectLoaded = !!configHandle || !!projectName;

  // Si le projet est déchargé, revenir au dashboard
  useEffect(() => {
    if (!projectLoaded) setShowDashboard(false);
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
        setShowAddCat(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [projectLoaded]);

  const handleAddCategory = async (key: string, id: number) => {
    await addCategory(key, id, '');
    setSelectedCatKey(key);
  };

  const handleDeleteCategory = (key: string, idx: number) => {
    deleteCategory(idx);
    setSelectedCatKey(null);
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
            onSelect={(key) => {
              setSelectedCatKey(key);
              setShowAddCat(false);
            }}
            onAdd={() => {
              setShowAddCat(true);
              setSelectedCatKey(null);
            }}
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
                  selectedKey={showAddCat ? null : selectedCatKey}
                  onAddCategory={handleAddCategory}
                  onDeleteCategory={handleDeleteCategory}
                  showAddForm={showAddCat}
                  onCloseAddForm={() => setShowAddCat(false)}
                />
              )}
              {activeTab === 'json' && <JsonViewer />}
            </div>
          )}
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
      <UnsavedModal />
      <NewRecipeModal
        open={newRecipeOpen}
        onClose={() => setNewRecipeOpen(false)}
      />
      <MissingFilesModal
        open={missingFilesOpen}
        warnings={missingFilesWarnings}
        onClose={closeMissingFiles}
      />
    </div>
  );
};
