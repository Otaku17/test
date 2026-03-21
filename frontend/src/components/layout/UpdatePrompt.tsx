/**
 * UpdatePrompt.tsx
 * — Sans projet chargé : bannière "toast" en haut au centre
 * — Avec projet chargé  : petit badge sous l'icône dans la NavRail
 *
 * useUpdateCheck() est un hook singleton (un seul appel API).
 * UpdateBanner  → affiché dans App.tsx quand pas de projet
 * UpdateNavBadge → affiché dans NavRail quand projet chargé
 */
import React, { useEffect, useState, createContext, useContext } from 'react';
import styles from './UpdatePrompt.module.css';

// ── Types ───────────────────────────────────────────────────────────────────────
type UpdateState = 'idle' | 'available' | 'downloading' | 'error';

interface UpdateCtx {
  state: UpdateState;
  latestVersion: string;
  assetName: string;
  dismissed: boolean;
  errorMsg: string;
  install: () => Promise<void>;
  dismiss: () => void;
}

// ── Context singleton ───────────────────────────────────────────────────────────
const UpdateContext = createContext<UpdateCtx | null>(null);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<UpdateState>('idle');
  const [latestVersion, setLatestVersion] = useState('');
  const [assetURL, setAssetURL] = useState('');
  const [assetName, setAssetName] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const fn = (window as any)?.go?.main?.App?.CheckUpdate;
        if (typeof fn !== 'function') return;
        const info = await fn();
        if (info?.hasUpdate && info.assetURL) {
          setLatestVersion(info.latestVersion);
          setAssetURL(info.assetURL);
          setAssetName(info.assetName);
          setState('available');
        }
      } catch {
        /* silent — no network is fine */
      }
    };
    const t = setTimeout(check, 4000);
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, []);

  const install = async () => {
    if (!assetURL || !assetName) return;
    setState('downloading');
    setErrorMsg('');
    try {
      const fn = (window as any)?.go?.main?.App?.DownloadAndInstallUpdate;
      if (typeof fn !== 'function') throw new Error('Not available');
      await fn(assetURL, assetName);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Installation failed');
      setState('error');
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        state,
        latestVersion,
        assetName,
        dismissed,
        errorMsg,
        install,
        dismiss: () => setDismissed(true),
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

const useUpdate = () => useContext(UpdateContext)!;

// ── Top-center banner (shown when no project is loaded) ────────────────────────
export const UpdateBanner: React.FC = () => {
  const {
    state,
    latestVersion,
    assetName,
    dismissed,
    errorMsg,
    install,
    dismiss,
  } = useUpdate();

  if (state === 'idle' || dismissed) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.bannerGlow} />

      {state === 'available' && (
        <>
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>New update available</span>
            <span className={styles.bannerSub}>
              Version <strong>v{latestVersion}</strong> is ready to install
            </span>
          </div>
          <button className={styles.bannerBtn} onClick={install}>
            Download &amp; Install
          </button>
          <button
            className={styles.bannerClose}
            onClick={dismiss}
            title="Dismiss"
          >
            ✕
          </button>
        </>
      )}

      {state === 'downloading' && (
        <>
          <span className={styles.bannerSpinner} />
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>Downloading update…</span>
            <span className={styles.bannerSub}>
              {assetName} — app will restart automatically
            </span>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <span className={styles.bannerIcon} style={{ color: 'var(--red)' }}>
            !
          </span>
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>Update failed</span>
            {errorMsg && <span className={styles.bannerSub}>{errorMsg}</span>}
          </div>
          <button className={styles.bannerBtn} onClick={install}>
            Retry
          </button>
          <button className={styles.bannerClose} onClick={dismiss}>
            ✕
          </button>
        </>
      )}
    </div>
  );
};

// ── NavRail badge (shown when a project is loaded) ─────────────────────────────
export const UpdateNavBadge: React.FC = () => {
  const { state, latestVersion, dismissed, errorMsg, install, dismiss } =
    useUpdate();
  const [expanded, setExpanded] = useState(false);

  if (state === 'idle' || dismissed) return null;

  return (
    <div className={styles.navBadgeWrap}>
      <button
        className={styles.navBadge}
        onClick={() => setExpanded((v) => !v)}
        title={`Update available: v${latestVersion}`}
      >
        <svg
          className={styles.navIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span className={styles.navLabel}>Update</span>
      </button>

      {expanded && (
        <div className={styles.navPopover}>
          {state === 'available' && (
            <>
              <div className={styles.popTitle}>
                 v{latestVersion} available
              </div>
              <button className={styles.popBtn} onClick={install}>
                Install &amp; restart
              </button>
              <button
                className={styles.popDismiss}
                onClick={() => {
                  dismiss();
                  setExpanded(false);
                }}
              >
                Dismiss
              </button>
            </>
          )}
          {state === 'downloading' && (
            <>
              <span className={styles.popSpinner} />
              <div className={styles.popTitle}>Downloading…</div>
              <div className={styles.popHint}>
                App will restart automatically.
              </div>
            </>
          )}
          {state === 'error' && (
            <>
              <div className={styles.popTitle}>! Failed</div>
              {errorMsg && <div className={styles.popHint}>{errorMsg}</div>}
              <button className={styles.popBtn} onClick={install}>
                Retry
              </button>
              <button
                className={styles.popDismiss}
                onClick={() => {
                  dismiss();
                  setExpanded(false);
                }}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Compatibility stub ──────────────────────────────────────────────────────────
export function useInstallPrompt() {
  return { canInstall: false, install: async () => {} };
}

// ── Legacy UpdatePrompt component — redirects based on projectLoaded ───────────
export const UpdatePrompt: React.FC<{ projectLoaded?: boolean }> = ({
  projectLoaded,
}) => {
  if (projectLoaded) return <UpdateNavBadge />;
  return <UpdateBanner />;
};
