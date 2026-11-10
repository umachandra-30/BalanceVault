import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, title, subtitle, icon, headerAction, style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        ...style,
      }}
    >
      {(title || icon || headerAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: subtitle ? '0.25rem' : '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {icon && <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>{icon}</span>}
            {title && <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {subtitle && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
