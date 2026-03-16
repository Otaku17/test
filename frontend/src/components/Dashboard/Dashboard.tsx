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

const FolderIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const TrashIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
const RefreshIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const Dashboard: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { openProject, openProjectPath } = useStore();
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    goCall('GetRecentProjects').then((data: RecentProject[] | null) => {
      if (data) setRecents(data);
    });
  }, []);

  const handleOpen = async (path: string) => {
    setLoading(path);
    setError((e) => ({ ...e, [path]: '' }));
    try {
      await openProjectPath(path);
      onOpen?.();
    } catch {
      setError((prev) => ({ ...prev, [path]: 'Folder not found' }));
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (path: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    await goCall('RemoveRecentProject', path);
    setRecents((r) => r.filter((p) => p.path !== path));
  };

  const handleRedefine = async (path: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    await openProject();
    goCall('GetRecentProjects').then((data: RecentProject[] | null) => {
      if (data) setRecents(data);
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* ── Logo + titre */}
        <div className={styles.hero}>
          <img src={appIconUrl} alt="Crafting Editor" className={styles.logo} />
          <h1 className={styles.title}>Crafting Editor</h1>
          <p className={styles.sub}>Pokémon SDK recipe editor</p>
        </div>

        {/* ── Bouton principal */}
        <button
          className={styles.openBtn}
          onClick={async () => {
            await openProject();
            onOpen?.();
          }}
        >
          <FolderIcon />
          Open project
        </button>

        {/* ── Projets récents */}
        {recents.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Recent</span>
            <div className={styles.list}>
              {recents.map((p) => {
                const isLoading = loading === p.path;
                const err = error[p.path];
                return (
                  <div
                    key={p.path}
                    className={`${styles.card} ${isLoading ? styles.cardBusy : ''} ${err ? styles.cardErr : ''}`}
                    onClick={() => !isLoading && handleOpen(p.path)}
                  >
                    {/* Icône projet */}
                    <div className={styles.cardThumb}>
                      {p.icon ? (
                        <img
                          src={p.icon}
                          alt=""
                          className={styles.cardThumbImg}
                        />
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                    </div>

                    {/* Infos */}
                    <div className={styles.cardBody}>
                      <span className={styles.cardName}>{p.name}</span>
                      <span className={styles.cardPath} title={p.path}>
                        {p.path}
                      </span>
                      {err ? (
                        <span className={styles.cardErrMsg}>{err}</span>
                      ) : (
                        timeAgo(p.openedAt) && (
                          <span className={styles.cardAge}>
                            {timeAgo(p.openedAt)}
                          </span>
                        )
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      className={styles.cardBtns}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {err && (
                        <button
                          className={styles.iconBtn}
                          title="Browse for new path"
                          onClick={(e) => handleRedefine(p.path, e)}
                        >
                          <RefreshIcon />
                        </button>
                      )}
                      <button
                        className={styles.iconBtn}
                        title="Remove"
                        onClick={(e) => handleRemove(p.path, e)}
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    {isLoading && <div className={styles.progress} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className={styles.hint}>
          <kbd>Ctrl+O</kbd> to open
        </p>
      </div>
    </div>
  );
};
