import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'all' | 'ball' | 'medical' | 'tm' | 'other'
  | 'accent' | 'green' | 'red' | 'yellow' | 'cyan' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function catVariant(cat: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    all: 'all', ball: 'ball', medical: 'medical', tm: 'tm',
  };
  return map[cat] ?? 'other';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'accent', className }) => (
  <span className={`${styles.badge} ${styles[variant]} ${className ?? ''}`}>
    {children}
  </span>
);
