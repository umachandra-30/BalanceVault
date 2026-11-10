import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export function Input({ label, error, helperText, leftIcon, id, style, ...props }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {leftIcon && (
          <span
            style={{
              position: 'absolute',
              left: '0.85rem',
              color: 'var(--text-muted)',
              display: 'flex',
              pointerEvents: 'none',
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-primary)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
            borderRadius: 6,
            padding: leftIcon ? '0.6rem 0.85rem 0.6rem 2.4rem' : '0.6rem 0.85rem',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            ...style,
          }}
          {...props}
        />
      </div>

      {error ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{helperText}</span>
      ) : null}
    </div>
  );
}
