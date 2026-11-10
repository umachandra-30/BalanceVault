import { Card } from '../components/Card.tsx';
import { Button } from '../components/Button.tsx';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div style={{ maxWidth: 500, margin: '5rem auto', padding: '0 1rem', textAlign: 'center', width: '100%' }}>
      <Card>
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
          <FileQuestion size={32} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          404 — Page Not Found
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
          The page or ledger resource you are attempting to access does not exist or has been relocated.
        </p>

        <Link to="/" style={{ textDecoration: 'none' }}>
          <Button variant="primary" leftIcon={<Home size={16} />}>
            Return to Dashboard
          </Button>
        </Link>
      </Card>
    </div>
  );
}
