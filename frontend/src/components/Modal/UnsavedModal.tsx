import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import styles from './Modal.module.css';

function confirmClose(shouldClose: boolean) {
  (window as any)?.go?.main?.App?.ConfirmClose?.(shouldClose);
}

export const UnsavedModal: React.FC = () => {
  const { dirty, saveAll } = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const runtime = (window as any)?.runtime;
    if (!runtime?.EventsOn) return;

    const unsub = runtime.EventsOn('app:before-close', () => {
      if (dirty) {
        setOpen(true);
      } else {
        confirmClose(true); // pas de changements → fermer
      }
    });

    return () => unsub?.();
  }, [dirty]);

  if (!open) return null;

  const handleSaveAndClose = async () => {
    setOpen(false);
    await saveAll();
    confirmClose(true);
  };

  const handleDiscardAndClose = () => {
    setOpen(false);
    confirmClose(true);
  };

  const handleCancel = () => {
    setOpen(false);
    confirmClose(false); // annuler → ne pas fermer
  };

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>Unsaved changes</h3>
        <p className={styles.desc}>
          You have unsaved changes. What would you like to do before closing?
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDiscardAndClose}>
            Discard & close
          </Button>
          <Button variant="success" onClick={handleSaveAndClose}>
            Save & close
          </Button>
        </div>
      </div>
    </div>
  );
};
