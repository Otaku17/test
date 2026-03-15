import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'warn';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}) => (
  <button
    className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className ?? ''}`}
    {...props}
  >
    {children}
  </button>
);
