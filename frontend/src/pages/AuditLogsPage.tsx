import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Card } from '../components/Card.tsx';
import { Badge } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { Input } from '../components/Input.tsx';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  FileCode,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuditLogItem {
  id: string;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  actor?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  targetResource: string;
  targetId: string | null;
  outcome: string;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditStats {
  totalCount: number;
  failureCount: number;
  financialCount: number;
  adminCount: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export function AuditLogsPage() {
  const { user, token } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/audit-logs/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStats(json.data);
      }
    } catch {
      // Non-blocking
    }
  };

  const fetchLogs = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter) params.set('action', actionFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (resourceFilter) params.set('targetResource', resourceFilter);

      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch audit records');
      }
      setLogs(json.data);
      if (json.meta) {
        setMeta(json.meta);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching audit logs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'AUDITOR')) {
      fetchLogs(1);
      fetchStats();
    }
  }, [token, actionFilter, outcomeFilter, resourceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > meta.totalPages) return;
    setPage(newPage);
    fetchLogs(newPage);
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'AUDITOR')) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <Card>
          <Lock size={48} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            The immutable audit trail is restricted strictly to Administrators and Compliance Auditors.
          </p>
          <Link to="/">
            <Button variant="primary">Return to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return <Badge variant="success">SUCCESS</Badge>;
      case 'DENIED':
        return <Badge variant="warning">DENIED</Badge>;
      case 'FAILURE':
        return <Badge variant="danger">FAILURE</Badge>;
      default:
        return <Badge variant="neutral">{outcome}</Badge>;
    }
  };

  const getActionBadgeVariant = (action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (action.includes('FAILURE') || action.includes('DENIED') || action.includes('BLOCKED')) return 'danger';
    if (action.includes('DEPOSIT') || action.includes('TRANSFER') || action.includes('WITHDRAWAL')) return 'info';
    if (action.includes('APPROVED')) return 'success';
    if (action.includes('REJECTED') || action.includes('FROZEN')) return 'warning';
    return 'neutral';
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            System Audit Trail & Compliance Ledger
          </h1>
          <Badge variant={user.role === 'AUDITOR' ? 'info' : 'success'}>
            {user.role === 'AUDITOR' ? 'Auditor Inspection View' : 'Administrative Audit Console'}
          </Badge>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Immutable chronologically sequenced events recording authentication, authorization, financial operations, and administrative overrides.
        </p>
      </div>

      {/* Aggregate Statistics Banner */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                TOTAL AUDIT EVENTS
              </span>
              <Shield size={18} color="var(--accent-primary)" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
              {stats.totalCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Append-only audit ledger
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                FINANCIAL OPERATIONS
              </span>
              <CheckCircle2 size={18} color="var(--success)" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
              {stats.financialCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Deposits, withdrawals, transfers
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                SECURITY & DENIALS
              </span>
              <XCircle size={18} color="var(--danger)" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--danger)' }}>
              {stats.failureCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              RBAC & credential rejections
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                ADMINISTRATIVE ACTIONS
              </span>
              <AlertTriangle size={18} color="var(--warning)" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
              {stats.adminCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              KYC reviews & status modifications
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters Bar */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Input
                placeholder="Search action, actor email, target ID, or correlation ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <SlidersHorizontal size={14} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Action:</span>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">All Actions</option>
                  <option value="USER_LOGIN">USER_LOGIN</option>
                  <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                  <option value="AUTHORIZATION_FAILURE">AUTHORIZATION_FAILURE</option>
                  <option value="DEPOSIT_EXECUTED">DEPOSIT_EXECUTED</option>
                  <option value="WITHDRAWAL_EXECUTED">WITHDRAWAL_EXECUTED</option>
                  <option value="TRANSFER_EXECUTED">TRANSFER_EXECUTED</option>
                  <option value="ACCOUNT_CREATED">ACCOUNT_CREATED</option>
                  <option value="ACCOUNT_STATUS_UPDATED">ACCOUNT_STATUS_UPDATED</option>
                  <option value="ONBOARDING_APPROVED">ONBOARDING_APPROVED</option>
                  <option value="ONBOARDING_REJECTED">ONBOARDING_REJECTED</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Outcome:</span>
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">All Outcomes</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="DENIED">DENIED</option>
                  <option value="FAILURE">FAILURE</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Resource:</span>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">All Resources</option>
                  <option value="USER">USER</option>
                  <option value="ACCOUNT">ACCOUNT</option>
                  <option value="TRANSACTION">TRANSACTION</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                </select>
              </div>

              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
                onClick={() => {
                  fetchLogs(page);
                  fetchStats();
                }}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--danger)',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Audit Logs Table */}
      <Card style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem' }}>
            <RefreshCw size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Querying immutable audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
            <ShieldAlert size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>No Audit Records Found</h3>
            <p style={{ fontSize: '0.85rem' }}>Try clearing your search query or filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>TIMESTAMP</th>
                  <th style={{ padding: '0.85rem 1rem' }}>ACTION</th>
                  <th style={{ padding: '0.85rem 1rem' }}>OUTCOME</th>
                  <th style={{ padding: '0.85rem 1rem' }}>ACTOR</th>
                  <th style={{ padding: '0.85rem 1rem' }}>TARGET RESOURCE</th>
                  <th style={{ padding: '0.85rem 1rem' }}>CORRELATION ID</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(log.createdAt).toLocaleDateString()}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getOutcomeBadge(log.outcome)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {log.actor ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.actor.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {log.actor.email} ({log.actor.role})
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {log.actorRole || 'System / Unauthenticated'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.targetResource}</span>
                      {log.targetId && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          ID: {log.targetId.substring(0, 10)}...
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {log.correlationId ? log.correlationId.substring(0, 12) + '...' : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing page <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{meta.page}</span> of{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{meta.totalPages}</span> ({meta.totalCount} total events)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => handlePageChange(meta.page - 1)}
              leftIcon={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => handlePageChange(meta.page + 1)}
              rightIcon={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              maxWidth: 620,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <FileCode size={20} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Audit Event Specification</h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {selectedLog.id}</div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>ACTION</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedLog.action}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>OUTCOME</span>
                <div>{getOutcomeBadge(selectedLog.outcome)}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>TARGET RESOURCE</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedLog.targetResource}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>TARGET ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {selectedLog.targetId || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>TIMESTAMP</span>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedLog.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>IP ADDRESS</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedLog.ipAddress || '127.0.0.1'}
                </span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>CORRELATION ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedLog.correlationId || 'None'}
                </span>
              </div>
            </div>

            {/* Sanitized Contextual Payload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                SANITIZED AUDIT METADATA PAYLOAD
              </span>
              <pre
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  padding: '1rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
