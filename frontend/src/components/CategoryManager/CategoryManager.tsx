import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import { Input } from '../layout/Form';
import {
  getCatColorDef, getCatColorVars, setCatColor,
  renameCatColor, deleteCatColor, deriveFromHex,
} from '../../utils/catColors';
import { DeleteCategoryModal } from '../Modal/DeleteCategoryModal';
import styles from './CategoryManager.module.css';

const CSV_LANGS = ['en', 'fr', 'it', 'de', 'es', 'ko', 'kana'] as const;
const LANG_LABELS: Record<string, string> = {
  en: 'English', fr: 'Français', it: 'Italiano', de: 'Deutsch',
  es: 'Español', ko: '한국어', kana: 'かな',
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const SaveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const DiscardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);
const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const HashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const PaletteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/>
    <circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
);

function ColoredBadge({ catKey }: { catKey: string }) {
  const [vars, setVars] = useState(() => getCatColorVars(catKey));
  useEffect(() => {
    setVars(getCatColorVars(catKey));
    const h = (e: Event) => {
      if ((e as CustomEvent).detail?.key === catKey) setVars(getCatColorVars(catKey));
    };
    window.addEventListener('catColorChanged', h);
    return () => window.removeEventListener('catColorChanged', h);
  }, [catKey]);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 'var(--radius-xs)',
      border: `1px solid ${vars.border}`, background: vars.bg, color: vars.text,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{catKey}</span>
  );
}

interface CategoryManagerProps {
  selectedKey: string | null;
  onDeleteCategory: (key: string, idx: number) => void;
  onRenameCategory: (newKey: string) => void;
  showAddForm: boolean;
  onCloseAddForm: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  selectedKey, onDeleteCategory, onRenameCategory,
}) => {
  const {
    lang, config, csvLines, csvHandle, csvDirty,
    updateCategoryId, renameCategory, updateCategoryTranslation, saveCsv, discardCsv,
  } = useStore();
  const hasCsv = !!csvHandle || csvLines.length > 0;

  const [drafts, setDrafts]         = useState<Record<number, string>>({});
  const [keyDraft, setKeyDraft]     = useState<string | null>(null);
  const [hexValue, setHexValue]     = useState('#9b7fe8');
  const [hexInput, setHexInput]     = useState('#9b7fe8');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const colorPickerRef              = useRef<HTMLInputElement>(null);

  const selectedCat = selectedKey ? config.categories.find(c => Object.keys(c)[0] === selectedKey) : null;
  const selectedIdx = selectedKey ? config.categories.findIndex(c => Object.keys(c)[0] === selectedKey) : -1;
  const selectedId  = selectedCat ? (Object.values(selectedCat)[0] as number) : null;
  const selectedLineIdx = selectedId != null ? selectedId + 1 : null;

  const getLineColumns = (idx: number) => csvLines[idx] ? parseCsvLine(csvLines[idx]) : [];
  const selectedCols = selectedLineIdx != null ? getLineColumns(selectedLineIdx) : [];

  useEffect(() => {
    if (selectedKey) {
      const base = getCatColorDef(selectedKey).base;
      setHexValue(base); setHexInput(base);
    }
    setDrafts({}); setKeyDraft(null);
  }, [selectedKey]);

  const applyColor = (hex: string) => {
    if (!selectedKey || selectedKey === 'all') return;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    setCatColor(selectedKey, hex);
    setHexValue(hex); setHexInput(hex);
    window.dispatchEvent(new CustomEvent('catColorChanged', { detail: { key: selectedKey } }));
  };

  const handleDraftChange = (colIdx: number, value: string) =>
    setDrafts(d => ({ ...d, [colIdx]: value }));

  const handleDraftBlur = (colIdx: number) => {
    if (selectedLineIdx == null) return;
    const val = drafts[colIdx];
    if (val === undefined) return;
    updateCategoryTranslation(selectedLineIdx, colIdx, val);
  };

  const handleKeyRename = async () => {
    if (keyDraft === null || selectedIdx < 0) return;
    const result = await renameCategory(selectedIdx, keyDraft);
    setKeyDraft(null);
    if (result) { renameCatColor(selectedKey!, result); onRenameCategory(result); }
  };

  const handleDelete = () => {
    if (!selectedKey || selectedIdx < 0) return;
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedKey || selectedIdx < 0) return;
    deleteCatColor(selectedKey);
    onDeleteCategory(selectedKey, selectedIdx);
  };

  const isAll = selectedKey === 'all';
  if (!config.categories) return null;

  const previewVars = /^#[0-9a-fA-F]{6}$/.test(hexInput.startsWith('#') ? hexInput : '#' + hexInput)
    ? deriveFromHex(hexInput.startsWith('#') ? hexInput : '#' + hexInput)
    : getCatColorVars(selectedKey ?? 'all');

  return (
    <div className={styles.root}>
      {!selectedKey || !selectedCat ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><TagIcon /></div>
          <span className={styles.emptyTitle}>Select a category</span>
          <span className={styles.emptyDesc}>Choose a category on the left to edit its details and translations.</span>
        </div>
      ) : (
        <div className={styles.editor}>
          {/* Header */}
          <div className={styles.editorHead}>
            <div className={styles.editorHeadLeft}>
              <ColoredBadge catKey={selectedKey} />
              {csvDirty && <span className={styles.unsavedBadge}>Unsaved</span>}
            </div>
            <div className={styles.editorHeadRight}>
              {csvDirty && (
                <>
                  <Button variant="warn" size="sm" onClick={() => { discardCsv(); setDrafts({}); }}>
                    <DiscardIcon /> Discard
                  </Button>
                  <Button variant="success" size="sm" onClick={saveCsv}>
                    <SaveIcon /> Save CSV
                  </Button>
                </>
              )}
              {!isAll ? (
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  <TrashIcon /> Delete
                </Button>
              ) : (
                <div style={{ width: 70, height: 28, flexShrink: 0 }} />
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className={styles.metaRow}>
            <div className={styles.metaCard}>
              <div className={styles.metaCardHead}><HashIcon /><span>Text ID</span></div>
              <Input type="number" value={selectedId ?? ''} disabled={isAll}
                style={{ width: '100%' }}
                onChange={e => updateCategoryId(selectedIdx, parseInt(e.target.value))} />
              <p className={styles.metaHint}>Line index in <code>140000.csv</code> (offset +1)</p>
            </div>

            <div className={styles.metaCard}>
              <div className={styles.metaCardHead}><TagIcon /><span>Key</span></div>
              {isAll ? (
                <div className={styles.keyDisplay}>
                  <ColoredBadge catKey={selectedKey} />
                  <span className={styles.metaHint} style={{ marginTop: 0 }}>Default — cannot be renamed</span>
                </div>
              ) : (
                <>
                  <input className={styles.keyInput}
                    value={keyDraft ?? selectedKey}
                    onChange={e => setKeyDraft(e.target.value)}
                    onFocus={() => setKeyDraft(selectedKey)}
                    onBlur={handleKeyRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setKeyDraft(null); (e.target as HTMLInputElement).blur(); }
                    }}
                    spellCheck={false} />
                  <p className={styles.metaHint}>Renaming updates all recipes using this category</p>
                </>
              )}
            </div>
          </div>

          {/* Color picker */}
          {!isAll && (
            <div className={styles.colorSection}>
              <div className={styles.colorSectionHead}><PaletteIcon /><span>Badge color</span></div>
              <div className={styles.colorRow}>
                <div className={styles.colorPickerWrap}
                  onClick={() => colorPickerRef.current?.click()}
                  style={{ background: hexValue, borderColor: previewVars.border }}
                  title="Open color picker"
                >
                  <input ref={colorPickerRef} type="color" value={hexValue}
                    onChange={e => applyColor(e.target.value)}
                    className={styles.nativePicker} />
                </div>
                <input className={styles.hexInput}
                  value={hexInput}
                  onChange={e => {
                    setHexInput(e.target.value);
                    const norm = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(norm)) applyColor(norm);
                  }}
                  onBlur={() => { const n = hexInput.startsWith('#') ? hexInput : '#' + hexInput; if (/^#[0-9a-fA-F]{6}$/.test(n)) applyColor(n); else setHexInput(hexValue); }}
                  spellCheck={false} maxLength={7} placeholder="#rrggbb" />
                <span className={styles.colorPreviewBadge} style={{
                  background: previewVars.bg, color: previewVars.text, border: `1px solid ${previewVars.border}`,
                }}>{selectedKey}</span>
              </div>
            </div>
          )}

          {/* Translations */}
          <div className={styles.translationsSection}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionHeadLeft}>
                <GlobeIcon />
                <span className={styles.sectionTitle}>Translations</span>
                <span className={styles.sectionCount}>{CSV_LANGS.length} languages</span>
              </div>
              {!hasCsv && <div className={styles.noCsvWarning}><AlertIcon /> No CSV loaded</div>}
            </div>
            {hasCsv ? (
              <div className={styles.langGrid}>
                {CSV_LANGS.map((l, colIdx) => {
                  const committed = selectedCols[colIdx] ?? '';
                  const draft = drafts[colIdx] ?? committed;
                  const isDirty = draft !== committed;
                  return (
                    <div key={l} className={`${styles.langCard} ${isDirty ? styles.langCardDirty : ''}`}>
                      <div className={styles.langCardHead}>
                        <span className={styles.langCode}>{l.toUpperCase()}</span>
                        <span className={styles.langName}>{LANG_LABELS[l] ?? l}</span>
                        {isDirty && <span className={styles.dirtyPip} />}
                      </div>
                      <input className={styles.langInput}
                        value={draft}
                        placeholder={`${LANG_LABELS[l] ?? l} name…`}
                        onChange={e => handleDraftChange(colIdx, e.target.value)}
                        onBlur={() => handleDraftBlur(colIdx)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.noCsvBlock}>
                <AlertIcon />
                <span>Open a project that includes a <code>140000.csv</code> file to edit translations.</span>
              </div>
            )}
          </div>
        </div>
      )}

      <DeleteCategoryModal
        catKey={deleteOpen ? selectedKey : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
