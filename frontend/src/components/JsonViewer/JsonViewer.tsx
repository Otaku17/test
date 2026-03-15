import React from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import styles from './JsonViewer.module.css';

export const JsonViewer: React.FC = () => {
  const { config, addToast } = useStore();
  const json = JSON.stringify(config, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json);
    addToast('📋 Copied!', 'ok');
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2>📄 crafting_config.json</h2>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={copy}>
          📋 Copy
        </Button>
      </div>
      <pre className={styles.code}>{json}</pre>
    </div>
  );
};
