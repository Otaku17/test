import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import appIconUrl from '../../assets/icon.png';
import styles from './Dashboard.module.css';

interface RecentProject {
  name: string;
  path: string;
  icon: string;
  openedAt: string;
}

function goCall(method: string, ...args: unknown[]): Promise<any> {
  const fn = (window as any)?.go?.main?.App?.[method];
  if (typeof fn !== 'function') return Promise.resolve(null);
  return fn(...args);
}

function timeAgo(ts: string): string {
  const n = parseInt(ts);
  if (isNaN(n) || n === 0) return '';
  const diff = Math.floor((Date.now() - n) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TrashIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const FolderPickIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const GRID_SIZE = 4;

export const Dashboard: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { openProject, openProjectPath } = useStore();
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, boolean>>({});

  const refreshRecents = async () => {
    const data: RecentProject[] | null = await goCall('GetRecentProjects');
    if (data) setRecents(data);
    return data;
  };

  // Au montage : charger les recents puis vérifier les paths invalides côté Go
  useEffect(() => {
    const init = async () => {
      await refreshRecents();
      const invalid: string[] | null = await goCall('CheckRecentPaths');
      if (invalid && invalid.length > 0) {
        const errMap: Record<string, boolean> = {};
        invalid.forEach((p) => {
          errMap[p] = true;
        });
        setError(errMap);
      }
    };
    init();
  }, []);

  const handleOpen = async (path: string) => {
    if (error[path]) return; // path invalide connu — ne rien faire
    setLoading(path);
    try {
      await openProjectPath(path);
      onOpen?.();
    } catch {
      setError((prev) => ({ ...prev, [path]: true }));
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (path: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    await goCall('RemoveRecentProject', path);
    setRecents((r) => r.filter((p) => p.path !== path));
    setError((e) => {
      const n = { ...e };
      delete n[path];
      return n;
    });
  };

  const handleRedefine = async (path: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setLoading(path);
    try {
      const data = await goCall('RedefineRecentProject', path);
      if (data) {
        await refreshRecents();
        setError((e) => {
          const n = { ...e };
          delete n[path];
          return n;
        });
        onOpen?.();
      }
    } catch {
      // annulé
    } finally {
      setLoading(null);
    }
  };

  const handleNewProject = async () => {
    await openProject();
    await refreshRecents();
    onOpen?.();
  };

  const slots: (RecentProject | null)[] = [
    ...recents.slice(0, GRID_SIZE),
    ...Array(Math.max(0, GRID_SIZE - recents.length)).fill(null),
  ];

  const firstEmptyIndex = slots.findIndex((s) => s === null);

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* Hero */}
        <div className={styles.hero}>
          <img src={appIconUrl} alt="Crafting Editor" className={styles.logo} />
          <div className={styles.heroText}>
            <h1 className={styles.title}>Crafting Editor</h1>
            <p className={styles.sub}>Pokémon SDK recipe editor</p>
          </div>
        </div>

        {/* Grille 2×2 */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Recent projects</span>
          <div className={styles.grid}>
            {slots.map((p, i) => {
              if (!p) {
                const isNext = i === firstEmptyIndex;
                return (
                  <button
                    key={`empty-${i}`}
                    className={`${styles.emptySlot} ${!isNext ? styles.emptySlotGhost : ''}`}
                    onClick={isNext ? handleNewProject : undefined}
                    disabled={!isNext}
                  >
                    {isNext && <PlusIcon />}
                    <span>{isNext ? 'Open project' : ''}</span>
                  </button>
                );
              }

              const isLoading = loading === p.path;
              const hasErr = !!error[p.path];

              return (
                <div
                  key={p.path}
                  className={[
                    styles.card,
                    isLoading ? styles.cardBusy : '',
                    hasErr ? styles.cardErr : '',
                  ].join(' ')}
                  onClick={() => !isLoading && !hasErr && handleOpen(p.path)}
                >
                  {isLoading && <div className={styles.progress} />}

                  {/* Header: thumb + actions */}
                  <div className={styles.cardHeader}>
                    <div
                      className={`${styles.cardThumb} ${hasErr ? styles.cardThumbErr : ''}`}
                    >
                      {p.icon ? (
                        <img
                          src={p.icon}
                          alt=""
                          className={styles.cardThumbImg}
                        />
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                    </div>

                    <div
                      className={styles.cardActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`${styles.actionBtn} ${styles.actionFolder} ${hasErr ? styles.actionFolderErr : ''}`}
                        title="Change project folder"
                        onClick={(e) => handleRedefine(p.path, e)}
                        disabled={isLoading}
                      >
                        <FolderPickIcon />
                        {hasErr && <span>Redefine</span>}
                      </button>

                      <button
                        className={`${styles.actionBtn} ${styles.actionDelete}`}
                        title="Remove from recents"
                        onClick={(e) => handleRemove(p.path, e)}
                        disabled={isLoading}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Infos */}
                  <div className={styles.cardBody}>
                    <span className={styles.cardName}>{p.name}</span>
                    <span className={styles.cardPath} title={p.path}>
                      {p.path}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    {hasErr ? (
                      <span className={styles.cardErrMsg}>
                       
                        Folder not found
                      </span>
                    ) : (
                      timeAgo(p.openedAt) && (
                        <span className={styles.cardAge}>
                          {timeAgo(p.openedAt)}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className={styles.hint}>
          <kbd>Ctrl+O</kbd> to open a project
        </p>
      </div>
    </div>
  );
};
