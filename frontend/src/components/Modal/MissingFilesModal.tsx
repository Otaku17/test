import React, { useEffect, useState } from 'react';
import styles from './MissingFilesModal.module.css';

interface MissingFile {
  name: string;
  path: string;
  description: string;
  critical: boolean;
}

interface MissingFilesModalProps {
  open: boolean;
  warnings: string[];
  onClose: () => void;
}

const RELEASE_URL = 'https://github.com/Otaku17/Crafting_psdk/releases';

const FILE_HINTS: Record<string, MissingFile> = {
  'plugin_missing': {
    name: 'crafting_config.json',
    path: 'Data/configs/crafting_config.json',
    description: 'The Crafting PSDK plugin is not installed in this project. Install the plugin first — it will generate this file automatically.',
    critical: true,
  },
  'csv_missing': {
    name: '140000.csv',
    path: 'Data/Text/Dialogs/140000.csv',
    description: 'CSV text file for category name translations. Category names will not be editable without it.',
    critical: false,
  },
  'items': {
    name: 'items/*.json',
    path: 'Data/Studio/items/',
    description: 'Item definitions from Pokémon SDK Studio.',
    critical: false,
  },
};

function parseWarnings(warnings: string[]): MissingFile[] {
  return warnings.map((w) => {
    const key = Object.keys(FILE_HINTS).find((k) => w.toLowerCase().includes(k.toLowerCase()));
    if (key) return FILE_HINTS[key];
    return {
      name: w,
      path: '',
      description: 'An unexpected error occurred while loading this file.',
      critical: false,
    };
  });
}

export const MissingFilesModal: React.FC<MissingFilesModalProps> = ({ open, warnings, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const files = parseWarnings(warnings);
  const hasCritical = false; // never block — user can always close and retry
  const isPluginMissing = warnings.includes('plugin_missing');

  useEffect(() => {
    if (open) {
      setClosing(false);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleClose = () => {
    if (hasCritical) return;
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const handleDownload = () => {
    window.open(RELEASE_URL, '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropVisible : ''} ${closing ? styles.backdropClosing : ''}`}
      onClick={hasCritical ? undefined : handleClose}
    >
      <div
        className={`${styles.modal} ${visible ? styles.modalVisible : ''} ${closing ? styles.modalClosing : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Missing project files</h2>
            <p className={styles.subtitle}>
              {isPluginMissing
                ? 'The Crafting PSDK plugin is not installed in this project.'
                : hasCritical
                  ? 'Critical files are missing. Please download the latest plugin.'
                  : 'Some optional files could not be found. Functionality may be limited.'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* File list */}
        <ul className={styles.fileList}>
          {files.map((file, i) => (
            <li key={i} className={`${styles.fileItem} ${file.critical ? styles.fileItemCritical : styles.fileItemWarn}`}>
              <div className={styles.fileMeta}>
                <div className={styles.fileHeader}>
                  <span className={`${styles.badge} ${file.critical ? styles.badgeCritical : styles.badgeWarn}`}>
                    {file.critical ? 'Required' : 'Optional'}
                  </span>
                  <span className={styles.fileName}>{file.name}</span>
                </div>
                {file.path && (
                  <code className={styles.filePath}>{file.path}</code>
                )}
                <p className={styles.fileDesc}>{file.description}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className={styles.footer}>
          {hasCritical && (
            <p className={styles.hint}>
              {isPluginMissing
                ? <>Install the <strong>Crafting PSDK</strong> plugin in your Pokémon Studio project, then reload.</>
                : <>Download the latest release of <strong>Crafting PSDK</strong> and place the missing files in your project.</>
              }
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.btnDownload} onClick={handleDownload}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.btnIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {isPluginMissing ? 'Get the plugin' : 'Download latest release'}
            </button>
            {!hasCritical && (
              <button className={styles.btnClose} onClick={handleClose}>
                Continue anyway
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
