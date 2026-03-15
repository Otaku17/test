/**
 * UpdatePrompt.tsx
 * Vérifie les MAJ en interrogeant /version.json sur la PWA déployée.
 * Affiche une bannière si une nouvelle version est disponible.
 */
import React, { useEffect, useState } from 'react';
import styles from './UpdatePrompt.module.css';

// URL de la PWA déployée — à adapter selon ton déploiement GitHub Pages
const PWA_BASE_URL = 'https://otaku17.github.io/crafting-editor';

let deferredPrompt: any = null;
export function useInstallPrompt() {
  return { canInstall: false, install: async () => {} };
}

export const UpdatePrompt: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const fn = (window as any)?.go?.main?.App?.CheckUpdate;
        if (typeof fn !== 'function') return;
        const info = await fn(PWA_BASE_URL);
        if (info?.hasUpdate) {
          setLatestVersion(info.latestVersion);
          setHasUpdate(true);
        }
      } catch {
        // silencieux si pas de réseau
      }
    };

    // Vérifier au démarrage après 3s, puis toutes les heures
    const t = setTimeout(check, 3000);
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  if (!hasUpdate || dismissed) return null;

  return (
    <div className={styles.prompt}>
      <span>🆕 Version {latestVersion} available</span>
      <a href={PWA_BASE_URL} target="_blank" rel="noopener noreferrer">
        Download
      </a>
      <button onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
};
