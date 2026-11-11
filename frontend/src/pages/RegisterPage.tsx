import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card.tsx';
import { Input } from '../components/Input.tsx';
import { Button } from '../components/Button.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { UserPlus, Mail, Lock, User, AlertCircle, Shield, CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ACCOUNT_HOLDER' | 'AUDITOR'>('ACCOUNT_HOLDER');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validation checks
    if (fullName.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }

    setIsLoading(true);
    try {
      const newUser = await register(fullName, email, password, role);
      setSuccessMessage('Registration successful! Redirecting to KYC onboarding...');
      setTimeout(() => {
        if (newUser.role === 'AUDITOR' || newUser.status === 'ACTIVE') {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '3.5rem auto', padding: '0 1rem', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: 'var(--accent-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <UserPlus size={28} />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Create an Account
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Join BalanceVault with double-entry auditable integrity
        </p>
      </div>

      <Card>
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--danger)',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--success)',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Full Name"
            type="text"
            placeholder="Alice Johnson"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User size={16} />}
            required
            disabled={isLoading}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="alice@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min 8 chars (Uppercase, lowercase, digit)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            required
            disabled={isLoading}
            helperText="Include at least one uppercase letter, lowercase letter, and number."
          />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Account Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setRole('ACCOUNT_HOLDER')}
                disabled={isLoading}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: 6,
                  border: `1px solid ${role === 'ACCOUNT_HOLDER' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: role === 'ACCOUNT_HOLDER' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  color: role === 'ACCOUNT_HOLDER' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <User size={15} />
                Account Holder
              </button>
              <button
                type="button"
                onClick={() => setRole('AUDITOR')}
                disabled={isLoading}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: 6,
                  border: `1px solid ${role === 'AUDITOR' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: role === 'AUDITOR' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  color: role === 'AUDITOR' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <Shield size={15} />
                Auditor (Read-Only)
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            leftIcon={<UserPlus size={16} />}
            isLoading={isLoading}
          >
            Create BalanceVault Account
          </Button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>
            Sign In here
          </Link>
        </div>
      </Card>
    </div>
  );
}
