import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from './Form.module.css';

// ── FormGroup ────────────────────────────────────────────────────────────────

interface FormGroupProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}
export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  children,
  className,
}) => (
  <div className={`${styles.group} ${className ?? ''}`}>
    {label && <label className={styles.label}>{label}</label>}
    {children}
  </div>
);

// ── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean;
}
export const Input: React.FC<InputProps> = ({
  compact,
  className,
  ...props
}) => (
  <input
    className={`${styles.input} ${compact ? styles.compact : ''} ${className ?? ''}`}
    {...props}
  />
);

// ── Custom Select ─────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  compact?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  icons?: Record<string, string>;
  children: React.ReactNode;
}

function parseOptions(
  children: React.ReactNode,
): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const el = child as React.ReactElement<{
      value?: string;
      children?: React.ReactNode;
    }>;
    if (el.type === 'option') {
      opts.push({
        value: String(el.props.value ?? ''),
        label: String(el.props.children ?? el.props.value ?? ''),
      });
    }
  });
  return opts;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  compact,
  fullWidth = true,
  className,
  style,
  disabled,
  icons,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = parseOptions(children);
  const current = options.find((o) => o.value === String(value ?? ''));
  const currentIcon = icons && current ? icons[current.value] : undefined;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const select = (val: string) => {
    if (onChange) {
      const syntheticEvent = {
        target: { value: val },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={style}
      className={[
        styles.customSelect,
        fullWidth ? styles.customSelectFull : '',
        compact ? styles.compact : '',
        open ? styles.customSelectOpen : '',
        disabled ? styles.customSelectDisabled : '',
        className ?? '',
      ].join(' ')}
    >
      <button
        type="button"
        className={styles.selectTrigger}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        {currentIcon && (
          <img src={currentIcon} className={styles.optionIcon} alt="" />
        )}
        <span className={styles.selectValue}>{current?.label ?? '—'}</span>
        <svg
          className={styles.selectChevron}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.selectDropdown}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={[
                  styles.selectOption,
                  opt.value === String(value ?? '')
                    ? styles.selectOptionActive
                    : '',
                ].join(' ')}
                onClick={() => select(opt.value)}
              >
                {icons?.[opt.value] && (
                  <img
                    src={icons[opt.value]}
                    className={styles.optionIcon}
                    alt=""
                  />
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── SearchSelect ──────────────────────────────────────────────────────────────

interface SearchSelectProps {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  compact?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  icons?: Record<string, string>;
  names?: Record<string, string>;
  showTriggerIcon?: boolean;
  children: React.ReactNode;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.optionMatch}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const SearchSelect: React.FC<SearchSelectProps> = ({
  value,
  onChange,
  compact,
  fullWidth = true,
  className,
  style,
  disabled,
  placeholder = 'Search…',
  icons,
  names,
  showTriggerIcon = true,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const allOptions = parseOptions(children);
  const filtered = query
    ? allOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (names?.[o.value] ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : allOptions;
  const current = allOptions.find((o) => o.value === String(value ?? ''));

  const measurePos = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  // ResizeObserver : recalcule dès que le container change de taille
  // Gère les grids CSS multi-passes, panels redimensionnés, etc.
  useEffect(() => {
    if (!open || !containerRef.current) return;
    measurePos();
    const ro = new ResizeObserver(measurePos);
    ro.observe(containerRef.current);
    window.addEventListener('scroll', measurePos, true);
    window.addEventListener('resize', measurePos);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measurePos, true);
      window.removeEventListener('resize', measurePos);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node);
      const inPortal = portalRef.current?.contains(e.target as Node);
      if (!inContainer && !inPortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (val: string) => {
    onChange?.({
      target: { value: val },
    } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-idx="${highlighted}"]`,
    ) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  return (
    <div
      ref={containerRef}
      className={[
        styles.customSelect,
        fullWidth ? styles.customSelectFull : '',
        compact ? styles.compact : '',
        open ? styles.customSelectOpen : '',
        disabled ? styles.customSelectDisabled : '',
        className ?? '',
      ].join(' ')}
      style={style}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.selectTrigger}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
      >
        {showTriggerIcon && icons?.[String(value ?? '')] && (
          <img
            src={icons[String(value ?? '')]}
            className={styles.optionIcon}
            alt=""
          />
        )}
        <span className={styles.selectValue}>
          {names?.[String(value ?? '')] ? (
            <>
              <span className={styles.selectValueName}>
                {names[String(value ?? '')]}
              </span>
            </>
          ) : (
            (current?.label ?? '—')
          )}
        </span>
        <svg
          className={styles.selectChevron}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        dropdownPos &&
        ReactDOM.createPortal(
          <div
            ref={portalRef}
            className={styles.selectDropdown}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              right: 'auto',
            }}
          >
            <div className={styles.searchBox}>
              <span className={styles.searchBoxIcon}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                ref={searchRef}
                type="text"
                className={styles.searchBoxInput}
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <span className={styles.searchCount}>{filtered.length}</span>
              )}
            </div>

            <div
              ref={listRef}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              {filtered.length === 0 && (
                <div className={styles.noResults}>No results for "{query}"</div>
              )}
              {filtered.map((opt, i) => (
                <button
                  key={opt.value}
                  data-idx={i}
                  type="button"
                  className={[
                    styles.selectOption,
                    opt.value === String(value ?? '')
                      ? styles.selectOptionActive
                      : '',
                    i === highlighted && opt.value !== String(value ?? '')
                      ? styles.selectOptionHighlighted
                      : '',
                  ].join(' ')}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => select(opt.value)}
                >
                  {icons?.[opt.value] && (
                    <img
                      src={icons[opt.value]}
                      className={styles.optionIcon}
                      alt=""
                    />
                  )}
                  <span className={styles.optionLabel}>
                    {names?.[opt.value] ? (
                      <>
                        <span className={styles.optionName}>
                          {highlight(names[opt.value], query)}
                        </span>
                        <span className={styles.optionSub}>
                          {highlight(opt.label, query)}
                        </span>
                      </>
                    ) : (
                      highlight(opt.label, query)
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
