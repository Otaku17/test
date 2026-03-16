import React, { useMemo } from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import styles from './JsonViewer.module.css';

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

/** Tokenise une ligne JSON en spans colorés */
function highlightJson(json: string): React.ReactNode[] {
  // Regex qui matche dans l'ordre : string, number, bool/null, punctuation
  const TOKEN = /("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(true|false|null)|([{}\[\],:])/g;

  return json.split('\n').map((line, li) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN.lastIndex = 0;

    while ((m = TOKEN.exec(line)) !== null) {
      // texte brut avant le token (indentation, espaces)
      if (m.index > last) {
        parts.push(line.slice(last, m.index));
      }

      const [full, str, num, kw, punct] = m;

      if (str) {
        // Distinguer clé (suivi de :) vs valeur string
        const isKey = line.slice(m.index + full.length).trimStart().startsWith(':');
        parts.push(
          <span key={m.index} className={isKey ? styles.tKey : styles.tStr}>{full}</span>
        );
      } else if (num) {
        parts.push(<span key={m.index} className={styles.tNum}>{full}</span>);
      } else if (kw) {
        parts.push(<span key={m.index} className={styles.tKw}>{full}</span>);
      } else if (punct) {
        parts.push(<span key={m.index} className={styles.tPunct}>{full}</span>);
      }

      last = m.index + full.length;
    }

    if (last < line.length) parts.push(line.slice(last));

    return <span key={li} className={styles.line}>{parts}{'\n'}</span>;
  });
}

export const JsonViewer: React.FC = () => {
  const { config, addToast } = useStore();
  const json = JSON.stringify(config, null, 2);
  const highlighted = useMemo(() => highlightJson(json), [json]);

  const copy = async () => {
    const fn = (window as any)?.runtime?.ClipboardSetText;
    if (typeof fn === 'function') await fn(json);
    else await navigator.clipboard.writeText(json).catch(() => {});
    addToast('Copied to clipboard', 'ok');
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.title}>crafting_config.json</span>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={copy}>
          <CopyIcon /> Copy
        </Button>
      </div>
      <pre className={styles.code}>{highlighted}</pre>
    </div>
  );
};
