/**
 * UpdatePrompt.tsx
 * Vérifie les MAJ en interrogeant l'API GitHub Releases.
 * Affiche une bannière si une nouvelle version est disponible,
 * avec un bouton "Download & Install" qui télécharge et installe
 * directement depuis le bon asset GitHub.
 */
import React, { useEffect, useState } from 'react';
import styles from './UpdatePrompt.module.css';

type UpdateState = 'idle' | 'available' | 'downloading' | 'error';

export const UpdatePrompt: React.FC = () => {
  const [state, setState]                 = useState<UpdateState>('idle');
  const [latestVersion, setLatestVersion] = useState('');
  const [assetURL, setAssetURL]           = useState('');
  const [assetName, setAssetName]         = useState('');
  const [dismissed, setDismissed]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

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
        // silencieux si pas de réseau
      }
    };

    // Vérifier au démarrage après 4s, puis toutes les heures
    const t = setTimeout(check, 4000);
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  const handleInstall = async () => {
    if (!assetURL || !assetName) return;
    setState('downloading');
    setErrorMsg('');
    try {
      const fn = (window as any)?.go?.main?.App?.DownloadAndInstallUpdate;
      if (typeof fn !== 'function') throw new Error('DownloadAndInstallUpdate not available');
      await fn(assetURL, assetName);
      // L'app va quitter d'elle-même après l'installation
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Installation failed');
      setState('error');
    }
  };

  if (dismissed || state === 'idle') return null;

  return (
    <div className={styles.prompt}>
      {state === 'available' && (
        <>
          <span className={styles.label}>🆕 Version <strong>{latestVersion}</strong> available</span>
          <button className={styles.btnPrimary} onClick={handleInstall}>
            ⬇ Download &amp; Install
          </button>
          <button className={styles.btnClose} onClick={() => setDismissed(true)} title="Dismiss">✕</button>
        </>
      )}

      {state === 'downloading' && (
        <>
          <span className={styles.loader} />
          <span className={styles.label}>Downloading {assetName}…</span>
          <span className={styles.hint}>The app will restart automatically.</span>
        </>
      )}

      {state === 'error' && (
        <>
          <span className={styles.label}>⚠ Update failed</span>
          {errorMsg && <span className={styles.hint}>{errorMsg}</span>}
          <button className={styles.btnPrimary} onClick={handleInstall}>Retry</button>
          <button className={styles.btnClose} onClick={() => setDismissed(true)}>✕</button>
        </>
      )}
    </div>
  );
};

// Stub conservé pour compatibilité avec TitleBar
export function useInstallPrompt() {
  return { canInstall: false, install: async () => {} };
}

