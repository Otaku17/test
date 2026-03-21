import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { Button } from '../layout/Button';
import { Input, Select } from '../layout/Form';
import { setCatColor, deriveFromHex } from '../../utils/catColors';
import styles from './Modal.module.css';
import catStyles from './NewCategoryModal.module.css';

interface NewCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (key: string) => void;
}

const DEFAULT_COLORS = ['#5b8af5','#4cba8a','#e86b6b','#e8a94a','#4ab8e8','#9b7fe8'];

function findFreeCsvLine(csvLines: string[], usedIds: Set<number>): number {
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i]?.trim();
    if ((!line || line === ','.repeat((line.match(/,/g) || []).length)) && !usedIds.has(i)) return i;
  }
  return Math.max(csvLines.length, 1);
}

const WarnIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const MigrateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);

export const NewCategoryModal: React.FC<NewCategoryModalProps> = ({ open, onClose, onCreated }) => {
  const { config, csvLines, addCategory, migrateCategoryRecipes, updateCategoryId } = useStore();

  const usedIds  = new Set(config.categories.map(c => Object.values(c)[0] as number));
  const usedKeys = new Set(config.categories.map(c => Object.keys(c)[0]));
  // User cats available to migrate FROM (excluding 'all')
  const migratableCats = config.categories
    .map(c => Object.keys(c)[0])
    .filter(k => k !== 'all');

  const [key, setKey]           = useState('');
  const [hexValue, setHexValue] = useState(DEFAULT_COLORS[0]);
  const [hexInput, setHexInput] = useState(DEFAULT_COLORS[0]);
  const [csvId, setCsvId]       = useState<number>(1);
  const [autoId, setAutoId]     = useState(true);
  const [doReplace, setDoReplace] = useState(false);
  // Migration: pick a source category whose recipes will move to the new one
  const [migrateFrom, setMigrateFrom] = useState<string>('');
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
  const keyExists     = normalizedKey.length > 0 && usedKeys.has(normalizedKey);

  // Count recipes using migrateFrom
  const migrateCount = migrateFrom
    ? Object.values(config.data).filter(r => r.category === migrateFrom).length
    : 0;

  useEffect(() => {
    if (!open) return;
    setKey(''); setDoReplace(false); setMigrateFrom(''); setAutoId(true);
    const hex = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    setHexValue(hex); setHexInput(hex);
  }, [open]);

  useEffect(() => {
    if (autoId) setCsvId(findFreeCsvLine(csvLines, usedIds));
  }, [autoId, csvLines, config.categories]);

  const applyHex = (hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    setHexValue(hex); setHexInput(hex);
  };

  const handleCreate = async () => {
    if (!normalizedKey) return;
    if (keyExists && !doReplace) return;

    if (keyExists && doReplace) {
      // Update existing cat's CSV id + color only
      const idx = config.categories.findIndex(c => Object.keys(c)[0] === normalizedKey);
      if (idx >= 0) updateCategoryId(idx, csvId);
      setCatColor(normalizedKey, hexValue);
      window.dispatchEvent(new CustomEvent('catColorChanged', { detail: { key: normalizedKey } }));
      // Migrate recipes from source cat if selected
      if (migrateFrom && migrateFrom !== normalizedKey) {
        await migrateCategoryRecipes(migrateFrom, normalizedKey);
      }
      onCreated(normalizedKey);
      onClose();
      return;
    }

    // Fresh creation
    await addCategory(normalizedKey, csvId, '');
    setCatColor(normalizedKey, hexValue);
    window.dispatchEvent(new CustomEvent('catColorChanged', { detail: { key: normalizedKey } }));
    // Migrate recipes from source cat if selected
    if (migrateFrom) {
      await migrateCategoryRecipes(migrateFrom, normalizedKey);
    }
    onCreated(normalizedKey);
    onClose();
  };

  if (!open) return null;

  const previewVars = deriveFromHex(hexValue);
  const idConflict  = !keyExists && usedIds.has(csvId);
  const canCreate   = normalizedKey.length > 0 && !(keyExists && !doReplace);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ width: 500 }}>
        <h3>New category</h3>
        <p className={styles.desc}>Define the key, color and CSV line for this category.</p>

        {/* ── Key ── */}
        <div className={styles.field}>
          <label className={catStyles.label}>Key</label>
          <Input
            value={key}
            onChange={e => { setKey(e.target.value); setDoReplace(false); }}
            placeholder="e.g. berries"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
          />
          {normalizedKey && normalizedKey !== key.trim() && (
            <span className={catStyles.hint}>Will be stored as: <code>{normalizedKey}</code></span>
          )}
        </div>

        {/* ── Duplicate warning ── */}
        {keyExists && (
          <div className={catStyles.warningBanner}>
            <WarnIcon />
            <span>Category <strong>"{normalizedKey}"</strong> already exists.</span>
            <button
              className={`${catStyles.switchBtn} ${doReplace ? catStyles.switchBtnActive : ''}`}
              onClick={() => setDoReplace(v => !v)}
            >
              {doReplace ? '✓ Update existing' : 'Update existing instead'}
            </button>
          </div>
        )}

        {/* ── Color ── */}
        <div className={styles.field}>
          <label className={catStyles.label}>Badge color</label>
          <div className={catStyles.colorRow}>
            {DEFAULT_COLORS.map(c => (
              <button key={c}
                className={`${catStyles.colorDot} ${hexValue === c ? catStyles.colorDotActive : ''}`}
                style={{ background: c }} onClick={() => applyHex(c)} title={c} />
            ))}
            <div className={catStyles.colorDivider} />
            <div className={catStyles.pickerSwatch} style={{ background: hexValue }}
              onClick={() => colorPickerRef.current?.click()} title="Custom color">
              <input ref={colorPickerRef} type="color" value={hexValue}
                onChange={e => applyHex(e.target.value)} className={catStyles.nativePicker} />
            </div>
            <input className={catStyles.hexInput} value={hexInput}
              onChange={e => { setHexInput(e.target.value); const n = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(n)) applyHex(n); }}
              onBlur={() => setHexInput(hexValue)} maxLength={7} placeholder="#rrggbb" spellCheck={false} />
          </div>
          {/* Live preview below the row */}
          <div className={catStyles.colorPreviewRow}>
            <span className={catStyles.colorPreviewLabel}>Preview</span>
            <span className={catStyles.previewBadge} style={{
              background: previewVars.bg, color: previewVars.text, border: `1px solid ${previewVars.border}`,
            }}>{normalizedKey || 'category'}</span>
          </div>
        </div>

        {/* ── CSV line ── */}
        <div className={styles.field}>
          <div className={catStyles.csvLabelRow}>
            <label className={catStyles.label}>CSV line index</label>
            <button className={`${catStyles.autoBtn} ${autoId ? catStyles.autoBtnActive : ''}`}
              onClick={() => setAutoId(v => !v)}>
              {autoId ? 'Auto' : 'Auto'}
            </button>
          </div>
          <Input type="number" value={csvId} min={1} disabled={autoId}
            onChange={e => { setAutoId(false); setCsvId(parseInt(e.target.value) || 1); }} />
          {idConflict
            ? <span className={catStyles.hintWarn}>Line {csvId} is already used by another category</span>
            : <span className={catStyles.hint}>
                {csvLines[csvId]?.trim()
                  ? `Line ${csvId} has content: "${csvLines[csvId].trim().slice(0, 40)}"`
                  : `Line ${csvId} is empty`}
              </span>
          }
        </div>

        {/* ── Migrate recipes ── */}
        <div className={catStyles.migrateSection}>
          <div className={catStyles.migrateSectionHead}>
            <MigrateIcon />
            <span>Migrate recipes from another category</span>
            <span className={catStyles.migrateOptional}>optional</span>
          </div>
          <div className={catStyles.migrateRow}>
            <Select
              value={migrateFrom}
              onChange={e => setMigrateFrom(e.target.value)}
              fullWidth
            >
              <option value="">— none —</option>
              {migratableCats
                .filter(k => k !== normalizedKey)
                .map(k => {
                  const count = Object.values(config.data).filter(r => r.category === k).length;
                  return (
                    <option key={k} value={k}>{k} ({count} recipe{count !== 1 ? 's' : ''})</option>
                  );
                })}
            </Select>
            {migrateFrom && (
              <span className={catStyles.migrateHint}>
                {migrateCount} recipe{migrateCount !== 1 ? 's' : ''} will move to
                <strong> {normalizedKey || '…'}</strong>
              </span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
            {keyExists && doReplace ? 'Update category' : 'Create category'}
            {migrateFrom ? ` + migrate` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};
