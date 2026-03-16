import React, { useState } from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import { Badge, catVariant } from '../layout/Badge';
import { Button } from '../layout/Button';
import { Input } from '../layout/Form';
import styles from './CategoryManager.module.css';

const CSV_LANGS = ['en', 'fr', 'it', 'de', 'es', 'ko', 'kana'] as const;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '',
    inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else cur += ch;
  }
  result.push(cur);
  return result;
}

interface CategoryManagerProps {
  selectedKey: string | null;
  onAddCategory: (key: string, id: number) => Promise<void>;
  onDeleteCategory: (key: string, idx: number) => void;
  showAddForm: boolean;
  onCloseAddForm: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  selectedKey,
  onAddCategory,
  onDeleteCategory,
  showAddForm,
  onCloseAddForm,
}) => {
  const {
    lang,
    config,
    csvLines,
    csvHandle,
    csvDirty,
    updateCategoryId,
    updateCategoryTranslation,
    saveCsv,
    discardCsv,
  } = useStore();
  const hasCsv = !!csvHandle || csvLines.length > 0;

  const [newKey, setNewKey] = useState('');
  const [newId, setNewId] = useState('');
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const getLineColumns = (lineIdx: number): string[] =>
    csvLines[lineIdx] ? parseCsvLine(csvLines[lineIdx]) : [];

  const selectedCat = selectedKey
    ? config.categories.find((c) => Object.keys(c)[0] === selectedKey)
    : null;
  const selectedIdx = selectedKey
    ? config.categories.findIndex((c) => Object.keys(c)[0] === selectedKey)
    : -1;
  const selectedId = selectedCat
    ? (Object.values(selectedCat)[0] as number)
    : null;
  const selectedLineIdx = selectedId != null ? selectedId + 1 : null;
  const selectedCols =
    selectedLineIdx != null ? getLineColumns(selectedLineIdx) : [];

  const handleDraftChange = (colIdx: number, value: string) =>
    setDrafts((d) => ({ ...d, [colIdx]: value }));

  const handleDraftBlur = (colIdx: number) => {
    if (selectedLineIdx == null) return;
    const val = drafts[colIdx];
    if (val === undefined) return;
    updateCategoryTranslation(selectedLineIdx, colIdx, val);
  };

  const handleAdd = async () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    const id = parseInt(newId);
    if (!key || isNaN(id)) return;
    await onAddCategory(key, id);
    setNewKey('');
    setNewId('');
    onCloseAddForm();
  };

  // ── Add form
  if (showAddForm) {
    return (
      <div className={styles.root}>
        <div className={styles.addPanel}>
          <h3 className={styles.addTitle}>New category</h3>
          <div className={styles.addRow}>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="key (e.g. ball)"
              style={{ flex: 1 }}
            />
            <Input
              type="number"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="Text ID"
              style={{ width: 90 }}
            />
          </div>
          <div className={styles.addActions}>
            <Button variant="ghost" size="sm" onClick={onCloseAddForm}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── No selection
  if (!selectedKey || !selectedCat) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>↖</span>
          <span>Select a category to edit</span>
        </div>
      </div>
    );
  }

  const isAll = selectedKey === 'all';

  // ── Editor
  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.head}>
        <Badge variant={catVariant(selectedKey)}>{selectedKey}</Badge>
        <span className={styles.headSub}>Category editor</span>
        <div style={{ flex: 1 }} />
        {csvDirty && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                discardCsv();
                setDrafts({});
              }}
            >
              ↩ Discard
            </Button>
            <Button variant="primary" size="sm" onClick={saveCsv}>
              Save CSV
            </Button>
          </>
        )}
        {!isAll && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                confirm(t(lang, 'confirm_del_cat').replace('{k}', selectedKey))
              )
                onDeleteCategory(selectedKey, selectedIdx);
            }}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Text ID */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Text ID</label>
        <Input
          type="number"
          value={selectedId ?? ''}
          disabled={isAll}
          style={{ width: 100 }}
          onChange={(e) =>
            updateCategoryId(selectedIdx, parseInt(e.target.value))
          }
        />
      </div>

      {/* Translations */}
      {hasCsv ? (
        <div className={styles.translations}>
          <div className={styles.transHead}>
            <span className={styles.transTitle}>Translations</span>
            {!hasCsv && <span className={styles.nocsv}>⚠ No CSV loaded</span>}
          </div>
          <div className={styles.langList}>
            {CSV_LANGS.map((l, colIdx) => {
              const committed = selectedCols[colIdx] ?? '';
              const draft = drafts[colIdx] ?? committed;
              const isDirty = draft !== committed;
              return (
                <div key={l} className={styles.langRow}>
                  <span
                    className={`${styles.langTag} ${isDirty ? styles.langTagDirty : ''}`}
                  >
                    {l.toUpperCase()}
                  </span>
                  <input
                    className={`${styles.langInput} ${isDirty ? styles.langInputDirty : ''}`}
                    value={draft}
                    placeholder={`${l} name…`}
                    onChange={(e) => handleDraftChange(colIdx, e.target.value)}
                    onBlur={() => handleDraftBlur(colIdx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.nocsv}>
          ⚠ No CSV loaded — open a project with a CSV file
        </div>
      )}
    </div>
  );
};
