import React from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import { getCatColorVars } from '../../utils/catColors';
import styles from './Modal.module.css';
import dStyles from './DeleteRecipeModal.module.css';

interface DeleteCategoryModalProps {
  catKey: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({ catKey, onClose, onConfirm }) => {
  const { config, itemNames } = useStore();

  if (!catKey) return null;

  // Recipes that will lose their category
  const affected = Object.entries(config.data)
    .filter(([, r]) => r.category === catKey)
    .map(([k]) => k);

  const vars = getCatColorVars(catKey);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h3>Delete category</h3>

        <p className={styles.desc}>
          Are you sure you want to delete{' '}
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            padding: '1px 7px', borderRadius: 'var(--radius-xs)',
            border: `1px solid ${vars.border}`,
            background: vars.bg, color: vars.text,
            verticalAlign: 'middle', margin: '0 2px',
          }}>{catKey}</span>
          ? This cannot be undone.
        </p>

        {affected.length > 0 && (
          <>
            <p className={styles.desc} style={{ marginBottom: 8, marginTop: -12 }}>
              <strong>{affected.length} recipe{affected.length > 1 ? 's' : ''}</strong> using this category will become uncategorized.
            </p>
            <div className={dStyles.depList}>
              {affected.map(k => (
                <div key={k} className={dStyles.depItem}>
                  <span className={dStyles.depName}>{itemNames[k] ?? k}</span>
                  <span className={dStyles.depKey}>{k}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm}>
            {affected.length > 0
              ? `Delete & uncategorize ${affected.length} recipe${affected.length > 1 ? 's' : ''}`
              : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
};
