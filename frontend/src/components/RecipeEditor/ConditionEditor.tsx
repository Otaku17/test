import React from 'react';
import { useStore } from '../../store';
import { t } from '../../utils/i18n';
import type { Condition, OperatorCondition, SimpleCondition } from '../../types';
import { Button } from '../layout/Button';
import { Select, SearchSelect, Input } from '../layout/Form';
import styles from './ConditionEditor.module.css';

const XIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

interface ConditionEditorProps { recipeKey: string; }

export const ConditionEditor: React.FC<ConditionEditorProps> = ({ recipeKey }) => {
  const { config, lang } = useStore();
  const cond = config.data[recipeKey]?.unlock_condition;

  return (
    <div className={styles.root}>
      {cond && <CondNode recipeKey={recipeKey} cond={cond} path="root" lang={lang} />}
    </div>
  );
};

interface NodeProps { recipeKey: string; cond: Condition; path: string; lang: string; }

const CondNode: React.FC<NodeProps> = ({ recipeKey, cond, path, lang }) => {
  const op = cond as OperatorCondition;
  if (op.operator) return <OpNode recipeKey={recipeKey} cond={op} path={path} lang={lang} />;
  return <SimpleNode recipeKey={recipeKey} cond={cond as SimpleCondition} path={path} lang={lang} />;
};

const SimpleNode: React.FC<{ recipeKey: string; cond: SimpleCondition; path: string; lang: string }> = ({
  recipeKey, cond, path, lang,
}) => {
  const { updateConditionByPath, config, itemNames, itemIcons } = useStore();
  const upd = (field: string, value: unknown) => updateConditionByPath(recipeKey, path, field, value);
  const recipeKeys = Object.keys(config.data);

  return (
    <div className={styles.simpleNode}>
      <div className={styles.condRow}>
        <span className={`${styles.condTag} ${styles[`ct_${cond.type}`]}`}>{cond.type}</span>

        {cond.type === 'manual' && (
          <Select compact fullWidth={false} style={{ width: 120 }} value={String(cond.value)}
            onChange={(e) => upd('value', e.target.value === 'true')}>
            <option value="true">{t(lang as any, 'unlocked')}</option>
            <option value="false">{t(lang as any, 'locked')}</option>
          </Select>
        )}
        {cond.type === 'switch' && (
          <>
            <span className={styles.condLabel}>{t(lang as any, 'id_lbl')}</span>
            <Input compact style={{ width: 72 }} type="number" value={cond.id}
              onChange={(e) => upd('id', parseInt(e.target.value))} />
          </>
        )}
        {cond.type === 'variable' && (
          <>
            <span className={styles.condLabel}>{t(lang as any, 'id_lbl')}</span>
            <Input compact style={{ width: 72 }} type="number" value={cond.id}
              onChange={(e) => upd('id', parseInt(e.target.value))} />
            <span className={styles.condLabel}>{t(lang as any, 'value_lbl')}</span>
            <Input compact style={{ width: 72 }} type="number" value={cond.value}
              onChange={(e) => upd('value', parseInt(e.target.value))} />
          </>
        )}
        {cond.type === 'recipe' && (
          <SearchSelect compact fullWidth={false} style={{ width: 220 }} value={cond.key}
            onChange={(e) => upd('key', e.target.value)}
            icons={itemIcons} names={itemNames} placeholder="Search recipes…" showTriggerIcon={true}>
            {recipeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </SearchSelect>
        )}
      </div>
    </div>
  );
};

const OpNode: React.FC<{ recipeKey: string; cond: OperatorCondition; path: string; lang: string }> = ({
  recipeKey, cond, path, lang,
}) => {
  const { updateConditionByPath, addChildCondition, removeChildCondition } = useStore();

  return (
    <div className={styles.opNode}>
      <div className={styles.opHead}>
        <span className={`${styles.condTag} ${styles.ct_operator}`}>OPERATOR</span>
        <Select compact fullWidth={false} style={{ width: 'auto' }} value={cond.operator}
          onChange={(e) => updateConditionByPath(recipeKey, path, 'operator', e.target.value)}>
          <option value="and">AND</option>
          <option value="or">OR</option>
        </Select>
        <div className={styles.opAddBtns}>
          {(['manual', 'switch', 'variable', 'recipe'] as const).map((type) => (
            <Button key={type} variant="ghost" size="sm"
              onClick={() => addChildCondition(recipeKey, path, type)}>
              <PlusIcon /> {type}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.opChildren}>
        {(cond.conditions || []).length === 0 ? (
          <span className={styles.empty}>{t(lang as any, 'no_cond')}</span>
        ) : (
          (cond.conditions || []).map((child, i) => (
            <div key={i} className={styles.childRow}>
              <div style={{ flex: 1 }}>
                <CondNode recipeKey={recipeKey} cond={child} path={`${path}.${i}`} lang={lang} />
              </div>
              <button className={styles.removeBtn}
                onClick={() => removeChildCondition(recipeKey, path, i)}>
                <XIcon />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
