import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
}

export function Badge({ children, variant = 'info', icon }: BadgeProps) {
  const getStyles = (): { bg: string; text: string; border: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--success-bg)',
          text: 'var(--success)',
          border: 'var(--success)',
        };
      case 'warning':
        return {
          bg: 'var(--warning-bg)',
          text: 'var(--warning)',
          border: 'var(--warning)',
        };
      case 'danger':
        return {
          bg: 'var(--danger-bg)',
          text: 'var(--danger)',
          border: 'var(--danger)',
        };
      case 'info':
      default:
        return {
          bg: 'var(--accent-glow)',
          text: 'var(--accent-primary)',
          border: 'var(--accent-primary)',
        };
    }
  };

  const { bg, text, border } = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        borderRadius: 20,
        fontSize: '0.78rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

