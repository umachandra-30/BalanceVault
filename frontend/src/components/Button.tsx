import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const isButtonLoading = isLoading || loading;

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--accent-primary)',
          border: '1px solid var(--accent-primary)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--danger)',
          color: '#ffffff',
          border: 'none',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning)',
          color: '#1a1a1a',
          border: 'none',
          fontWeight: 600,
        };
      case 'primary':
      default:
        return {
          backgroundColor: 'var(--accent-primary)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 2px 8px var(--accent-glow)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: 6 };
      case 'lg':
        return { padding: '0.75rem 1.5rem', fontSize: '1rem', borderRadius: 8 };
      case 'md':
      default:
        return { padding: '0.55rem 1.1rem', fontSize: '0.875rem', borderRadius: 6 };
    }
  };

  return (
    <button
      disabled={disabled || isButtonLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontWeight: 600,
        cursor: disabled || isButtonLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isButtonLoading ? 0.65 : 1,
        transition: 'all 0.15s ease-in-out',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isButtonLoading ? (
        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
      ) : (
        leftIcon
      )}
      {children}
      {!isButtonLoading && rightIcon}
    </button>
  );
}

