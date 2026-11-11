import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card.tsx';
import { Input } from '../components/Input.tsx';
import { Button } from '../components/Button.tsx';
import { Badge } from '../components/Badge.tsx';
import { useAuth, UserOnboarding } from '../context/AuthContext.tsx';
import { FileText, ShieldAlert, CheckCircle2, Clock, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, token, loading: authLoading, refreshUser } = useAuth();

  const [onboarding, setOnboarding] = useState<UserOnboarding | null>(null);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [documentType, setDocumentType] = useState<'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID'>('PASSPORT');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/onboarding/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setOnboarding(json.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (token) {
      fetchStatus();
    }
  }, [user, token, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (documentNumber.trim().length < 5) {
      setErrorMessage('Document number must be at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/onboarding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentType,
          documentNumber,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to submit onboarding.');
      }

      setSuccessMessage('KYC documentation submitted successfully! Awaiting review.');
      setOnboarding(json.data);
      await refreshUser();
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ maxWidth: 650, margin: '4rem auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading onboarding status...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '3.5rem auto', padding: '0 1rem', width: '100%' }}>
      {/* Title Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Badge variant="info">Identity Verification (KYC/AML)</Badge>
          {onboarding?.status && (
            <Badge
              variant={
                onboarding.status === 'APPROVED'
                  ? 'success'
                  : onboarding.status === 'REJECTED'
                  ? 'danger'
                  : onboarding.status === 'SUBMITTED'
                  ? 'warning'
                  : 'info'
              }
            >
              Status: {onboarding.status}
            </Badge>
          )}
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Account Holder Onboarding
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          BalanceVault requires verified identification before activating deposit and transfer capabilities.
        </p>
      </div>

      {/* State A: Already Approved */}
      {onboarding?.status === 'APPROVED' && (
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Onboarding Verified & Approved
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 450, margin: '0 auto 1.5rem auto' }}>
              Your identity has been confirmed by compliance. Your primary checking account is now active and ready for transactions.
            </p>

            {onboarding.notes && (
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-primary)', borderRadius: 6, fontSize: '0.85rem', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Reviewer Feedback: </span>
                <span>{onboarding.notes}</span>
              </div>
            )}

            <Button
              variant="primary"
              onClick={() => navigate('/dashboard')}
              rightIcon={<ArrowRight size={16} />}
            >
              Proceed to Financial Dashboard
            </Button>
          </div>
        </Card>
      )}

      {/* State B: Submitted / In Review */}
      {(onboarding?.status === 'SUBMITTED' || onboarding?.status === 'IN_REVIEW') && (
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--warning-bg)',
                color: 'var(--warning)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Clock size={32} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Verification Under Administrator Review
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto 1.5rem auto' }}>
              Your KYC submission is in the compliance queue. An administrator will review your credentials shortly.
            </p>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Document Type</span>
                <span style={{ fontWeight: 600 }}>{onboarding.documentType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Masked Identifier</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{onboarding.documentNumberMasked}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Submission Date</span>
                <span>{onboarding.submittedAt ? new Date(onboarding.submittedAt).toLocaleString() : 'Just now'}</span>
              </div>
            </div>

            <Button variant="secondary" onClick={fetchStatus}>
              Refresh Status
            </Button>
          </div>
        </Card>
      )}

      {/* State C: Rejected */}
      {onboarding?.status === 'REJECTED' && (
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <XCircle size={32} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--danger)' }}>
              Onboarding Application Rejected
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 450, margin: '0 auto 1.5rem auto' }}>
              Your verification could not be approved based on the submitted documentation.
            </p>

            {onboarding.notes && (
              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-primary)', borderRadius: 6, fontSize: '0.85rem', border: '1px solid var(--danger)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Compliance Note: </span>
                <span>{onboarding.notes}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* State D: Not Started (Render Submission Form) */}
      {(!onboarding || onboarding.status === 'NOT_STARTED') && (
        <Card title="Submit Identity Credentials" icon={<ShieldCheck size={20} />}>
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
              <ShieldAlert size={18} />
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
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Identity Document Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocumentType(type)}
                    disabled={isSubmitting}
                    style={{
                      padding: '0.6rem 0.4rem',
                      borderRadius: 6,
                      border: `1px solid ${documentType === type ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      backgroundColor: documentType === type ? 'var(--accent-glow)' : 'var(--bg-primary)',
                      color: documentType === type ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Document Identification Number"
              type="text"
              placeholder="e.g., P982348102 or D-1928471"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
              disabled={isSubmitting}
              helperText="For data protection, raw numbers are masked (e.g. ******4810) before storage."
              leftIcon={<FileText size={16} />}
            />

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Applicant Notes or Demonstration Context (Optional)
              </label>
              <textarea
                placeholder="Synthetic demonstration submission for BalanceVault onboarding."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  minHeight: 80,
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '0.6rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              style={{ width: '100%' }}
              isLoading={isSubmitting}
              leftIcon={<ShieldCheck size={16} />}
            >
              Submit Onboarding Application
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
