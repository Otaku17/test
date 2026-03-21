import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import styles from './JsonViewer.module.css';

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const BracesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
    <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>
  </svg>
);

function highlightJson(json: string): React.ReactNode[] {
  const TOKEN = /(\"(?:[^\"\\]|\\.)*\")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(true|false|null)|([{}\[\],:])/g;

  return json.split('\n').map((line, li) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN.lastIndex = 0;

    while ((m = TOKEN.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const [full, str, num, kw, punct] = m;

      if (str) {
        const isKey = line.slice(m.index + full.length).trimStart().startsWith(':');
        parts.push(<span key={m.index} className={isKey ? styles.tKey : styles.tStr}>{full}</span>);
      } else if (num) {
        parts.push(<span key={m.index} className={styles.tNum}>{full}</span>);
      } else if (kw) {
        parts.push(<span key={m.index} className={styles.tKw}>{full}</span>);
      } else if (punct) {
        const isOpen = punct === '{' || punct === '[';
        const isClose = punct === '}' || punct === ']';
        const cls = isOpen ? styles.tBraceOpen : isClose ? styles.tBraceClose : styles.tPunct;
        parts.push(<span key={m.index} className={cls}>{full}</span>);
      }
      last = m.index + full.length;
    }

    if (last < line.length) parts.push(line.slice(last));

    return (
      <span key={li} className={styles.line}>
        <span className={styles.lineNum}>{li + 1}</span>
        <span className={styles.lineContent}>{parts}{'\n'}</span>
      </span>
    );
  });
}

export const JsonViewer: React.FC = () => {
  const { config, addToast } = useStore();
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(config, null, 2);
  const highlighted = useMemo(() => highlightJson(json), [json]);

  const lineCount = json.split('\n').length;
  const charCount = json.length;
  const recipeCount = Object.keys(config.data || {}).length;
  const catCount = (config.categories || []).length;

  const copy = async () => {
    const fn = (window as any)?.runtime?.ClipboardSetText;
    if (typeof fn === 'function') await fn(json);
    else await navigator.clipboard.writeText(json).catch(() => {});
    addToast('Copied to clipboard', 'ok');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.fileIcon}><BracesIcon /></span>
          <div className={styles.headMeta}>
            <span className={styles.title}>crafting_config.json</span>
            <div className={styles.pills}>
              <span className={styles.pill}>{recipeCount} recipes</span>
              <span className={styles.pillDot} />
              <span className={styles.pill}>{catCount} categories</span>
              <span className={styles.pillDot} />
              <span className={styles.pill}>{lineCount} lines</span>
            </div>
          </div>
        </div>
        <div className={styles.headRight}>
          <span className={styles.charCount}>{charCount.toLocaleString()} chars</span>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy</>}
          </Button>
        </div>
      </div>

      <div className={styles.codeWrap}>
        <pre className={styles.code}>{highlighted}</pre>
      </div>
    </div>
  );
};
