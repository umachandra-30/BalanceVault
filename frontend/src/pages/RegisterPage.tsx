import React, { useState } from 'react';
import { Card } from '../components/Card.tsx';
import { Input } from '../components/Input.tsx';
import { Button } from '../components/Button.tsx';
import { Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, Shield } from 'lucide-react';

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ACCOUNT_HOLDER' | 'AUDITOR'>('ACCOUNT_HOLDER');
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('Phase 1 Foundation Setup: User Registration backend API is planned for Phase 3.');
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
        {notice && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--accent-glow)',
              color: 'var(--accent-primary)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--accent-primary)',
            }}
          >
            <AlertCircle size={18} />
            <span>{notice}</span>
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
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="alice@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            required
          />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Account Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setRole('ACCOUNT_HOLDER')}
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
                }}
              >
                <User size={15} />
                Account Holder
              </button>
              <button
                type="button"
                onClick={() => setRole('AUDITOR')}
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

