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
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

export const CategoryManager: React.FC = () => {
  const {
    lang, config, csvLines, csvHandle, csvDirty,
    addCategory, deleteCategory, updateCategoryId,
    updateCategoryTranslation, saveCsv, discardCsv,
  } = useStore();

  // En mode desktop csvHandle est null — on vérifie csvLines à la place
  const hasCsv = !!csvHandle || csvLines.length > 0;

  const [newKey, setNewKey] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  // Which category row is selected for translation
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Per-lang draft values { colIdx -> draftValue }
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const getLineColumns = (lineIdx: number): string[] =>
    csvLines[lineIdx] ? parseCsvLine(csvLines[lineIdx]) : [];

  const selectedCat = selectedKey
    ? config.categories.find(c => Object.keys(c)[0] === selectedKey)
    : null;
  const selectedId = selectedCat ? Object.values(selectedCat)[0] as number : null;
  const selectedLineIdx = selectedId != null ? selectedId + 1 : null;
  const selectedCols = selectedLineIdx != null ? getLineColumns(selectedLineIdx) : [];

  const selectRow = (key: string) => {
    setSelectedKey(prev => prev === key ? null : key);
    setDrafts({});
  };

  const handleDraftChange = (colIdx: number, value: string) => {
    setDrafts(d => ({ ...d, [colIdx]: value }));
  };

  const handleDraftBlur = (colIdx: number) => {
    if (selectedLineIdx == null) return;
    const val = drafts[colIdx];
    if (val === undefined) return;
    updateCategoryTranslation(selectedLineIdx, colIdx, val);
    // Keep draft in sync with committed value
  };

  const closePanel = () => {
    // Commit any pending drafts to memory (no CSV write)
    if (selectedLineIdx != null) {
      Object.entries(drafts).forEach(([col, val]) => {
        updateCategoryTranslation(selectedLineIdx, parseInt(col), val);
      });
    }
    setSelectedKey(null);
    setDrafts({});
  };

  const handleAdd = async () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    const id = parseInt(newId);
    if (!key || isNaN(id)) return;
    const lineIdx = id + 1;
    const existingCols = getLineColumns(lineIdx);
    if (existingCols.some(c => c.trim() !== '')) {
      const alreadyOurs = config.categories.find(c => Object.values(c)[0] === id);
      if (!alreadyOurs) {
        useStore.getState().addToast(`❌ CSV line ${id} is already used`, 'err');
        return;
      }
    }
    await addCategory(key, id, '');
    setNewKey(''); setNewId(''); setNewName('');
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.headRow}>
          <div>
            <h2>{t(lang, 'categories_tab')}</h2>
            <p dangerouslySetInnerHTML={{ __html: t(lang, 'cat_desc') }} />
          </div>
          {!hasCsv && <span className={styles.nocsv}>⚠ No CSV loaded</span>}
        </div>
      </div>

      <div className={styles.body}>
        {/* Left — category table */}
        <div className={styles.left}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t(lang, 'th_key')}</th>
                  <th>{t(lang, 'th_tid')}</th>
                  <th>{t(lang, 'th_name')} (en)</th>
                  <th style={{ textAlign: 'right' }}>{t(lang, 'th_act')}</th>
                </tr>
              </thead>
              <tbody>
                {(config.categories || []).map((obj, idx) => {
                  const key = Object.keys(obj)[0];
                  const id = Object.values(obj)[0] as number;
                  const lineIdx = id + 1;
                  const cols = getLineColumns(lineIdx);
                  const enName = cols[0] ?? '';
                  const isAll = key === 'all';
                  const isSelected = selectedKey === key;

                  return (
                    <tr
                      key={key}
                      className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                      onClick={() => hasCsv && selectRow(key)}
                    >
                      <td><Badge variant={catVariant(key)}>{key}</Badge></td>
                      <td>
                        <input
                          type="number" className={styles.idInput} value={id} disabled={isAll}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => updateCategoryId(idx, parseInt(e.target.value))}
                        />
                      </td>
                      <td>
                        <span className={styles.enName}>
                          {enName || <em className={styles.csvEmpty}>—</em>}
                        </span>
                        {hasCsv && !isSelected && (
                          <span className={styles.editHint}>✎ edit</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        {isAll
                          ? <span className={styles.protectedHint}>protected</span>
                          : <Button variant="danger" size="sm" onClick={() => {
                              if (confirm(t(lang, 'confirm_del_cat').replace('{k}', key)))
                                deleteCategory(idx);
                            }}>{t(lang, 'delete')}</Button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.addForm}>
            <Input value={newKey} onChange={(e) => setNewKey(e.target.value)}
              placeholder={t(lang, 'cat_key_ph')} style={{ width: 140 }} />
            <Input type="number" value={newId} onChange={(e) => setNewId(e.target.value)}
              placeholder="Text ID" style={{ width: 90 }} />
            <Button variant="primary" size="sm" onClick={handleAdd}>+ {t(lang, 'add')}</Button>
          </div>
        </div>

        {/* Right — translation panel */}
        <div className={`${styles.right} ${selectedKey ? styles.rightOpen : ''}`}>
          {selectedKey ? (
            <>
              <div className={styles.panelHead}>
                <div className={styles.panelTitle}>
                  <Badge variant={catVariant(selectedKey)}>{selectedKey}</Badge>
                  <span className={styles.panelSub}>Translations</span>
                </div>
                <div className={styles.panelActions}>
                  {csvDirty && <>
                    <Button variant="ghost" size="sm" onClick={() => { discardCsv(); setDrafts({}); }}>↩</Button>
                    <Button variant="primary" size="sm" onClick={saveCsv}>💾 Save</Button>
                  </>}
                  <button className={styles.panelClose} onClick={closePanel}>✕</button>
                </div>
              </div>

              <div className={styles.langList}>
                {CSV_LANGS.map((l, colIdx) => {
                  const committed = selectedCols[colIdx] ?? '';
                  const draft = drafts[colIdx] ?? committed;
                  const isDirty = draft !== committed;
                  return (
                    <div key={l} className={styles.langRow}>
                      <span className={`${styles.langTag} ${isDirty ? styles.langTagDirty : ''}`}>
                        {l.toUpperCase()}
                      </span>
                      <input
                        className={`${styles.langInput} ${isDirty ? styles.langInputDirty : ''}`}
                        value={draft}
                        placeholder={`${l} name…`}
                        onChange={e => handleDraftChange(colIdx, e.target.value)}
                        onBlur={() => handleDraftBlur(colIdx)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={styles.panelEmpty}>
              {hasCsv
                ? <><span className={styles.panelEmptyIcon}>✎</span><span>Select a category to edit translations</span></>
                : <span>Open a project to edit CSV</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
