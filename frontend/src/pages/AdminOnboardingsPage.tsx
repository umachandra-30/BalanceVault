import { useEffect, useState } from 'react';
import { Card } from '../components/Card.tsx';
import { Button } from '../components/Button.tsx';
import { Badge } from '../components/Badge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface OnboardingItem {
  id: string;
  userId: string;
  status: 'NOT_STARTED' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  documentType: string | null;
  documentNumberMasked: string | null;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    createdAt: string;
  };
  reviewedBy?: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}

export function AdminOnboardingsPage() {
  const { user, token } = useAuth();
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('SUBMITTED');

  // Review modal / action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<{ [id: string]: string }>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOnboardings = async () => {
    if (!token || user?.role !== 'ADMIN') return;
    setLoading(true);
    setNotification(null);

    try {
      const url = filter === 'ALL'
        ? '/api/v1/admin/onboardings'
        : `/api/v1/admin/onboardings?status=${filter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Failed to fetch onboardings' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error fetching onboarding requests' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnboardings();
  }, [token, filter, user]);

  const handleReview = async (onboardingId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(onboardingId);
    setNotification(null);

    try {
      const notes = reviewNotes[onboardingId] || (decision === 'APPROVED' ? 'Approved by Admin' : 'Rejected by Admin');
      const res = await fetch(`/api/v1/admin/onboardings/${onboardingId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, notes }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Review action failed');
      }

      setNotification({
        type: 'success',
        message: `Application ${decision.toLowerCase()} successfully! User status updated.`,
      });

      // Refresh list
      await fetchOnboardings();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Review action error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div style={{ maxWidth: 600, margin: '5rem auto', textAlign: 'center' }}>
        <Card>
          <div style={{ padding: '2rem', color: 'var(--danger)' }}>
            <AlertCircle size={40} style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Access Denied</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Only system administrators can review customer onboarding submissions.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '2.5rem auto', padding: '0 1.5rem', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Badge variant="info">Admin Console</Badge>
            <Badge variant="success">Role: ADMIN</Badge>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Onboarding & KYC Review Queue
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Verify applicant credentials, review documentation, and authorize active account status.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchOnboardings} leftIcon={<RefreshCw size={14} />}>
          Refresh Queue
        </Button>
      </div>

      {notification && (
        <div
          style={{
            padding: '0.85rem',
            borderRadius: 6,
            backgroundColor: notification.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            border: `1px solid ${notification.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {(['SUBMITTED', 'ALL', 'APPROVED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 6,
              border: 'none',
              backgroundColor: filter === tab ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: filter === tab ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {tab === 'SUBMITTED' ? 'Pending Review' : tab}
          </button>
        ))}
      </div>

      {/* Items List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading onboarding requests...
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No onboarding applications found.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              There are currently no requests matching the filter '{filter}'.
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <Card key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{item.user.fullName}</span>
                    <Badge
                      variant={
                        item.status === 'APPROVED'
                          ? 'success'
                          : item.status === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Email: <strong>{item.user.email}</strong></span>
                    <span>Document: <strong>{item.documentType || 'N/A'}</strong></span>
                    <span>Masked ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.documentNumberMasked || 'N/A'}</strong></span>
                    <span>Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  {item.notes && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      &ldquo;{item.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Review Actions if Pending */}
                {item.status === 'SUBMITTED' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 260 }}>
                    <input
                      type="text"
                      placeholder="Optional review note..."
                      value={reviewNotes[item.id] || ''}
                      onChange={(e) =>
                        setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })
                      }
                      style={{
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.8rem',
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleReview(item.id, 'APPROVED')}
                        isLoading={actionLoadingId === item.id}
                        leftIcon={<CheckCircle2 size={14} />}
                        style={{ flex: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleReview(item.id, 'REJECTED')}
                        isLoading={actionLoadingId === item.id}
                        leftIcon={<XCircle size={14} />}
                        style={{ flex: 1 }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {item.status !== 'SUBMITTED' && item.reviewedBy && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    <span>Reviewed by {item.reviewedBy.fullName}</span>
                    <br />
                    <span>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ''}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
