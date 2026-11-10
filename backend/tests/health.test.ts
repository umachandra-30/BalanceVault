import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { sanitize } from '../src/config/logger.js';

describe('BalanceVault Foundation Tests', () => {
  const app = createApp();

  describe('Health & Readiness Endpoints', () => {
    it('GET /api/v1/health returns 200 with UP status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.service).toBe('BalanceVault Core API');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });

    it('GET /api/v1/ready returns 200 with READY status', async () => {
      const res = await request(app).get('/api/v1/ready');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.memory).toBeDefined();
      expect(res.body.data.services).toBeDefined();
    });
  });

  describe('Error Handling Middleware', () => {
    it('returns 404 for unknown route', async () => {
      const res = await request(app).get('/api/v1/unknown-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(res.body.error.message).toContain('Cannot GET /api/v1/unknown-endpoint');
    });

    it('returns 400 for malformed JSON request', async () => {
      const res = await request(app)
        .post('/api/v1/health')
        .set('Content-Type', 'application/json')
        .send('{ invalidJson:');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MALFORMED_JSON');
    });
  });

  describe('Security & Sensitive Data Redaction', () => {
    it('properly redacts sensitive keys from objects and connection strings', () => {
      const sensitiveInput = {
        username: 'john_doe',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          secret: 'api-secret-value',
          safeField: 'hello',
        },
        connectionString: 'postgresql://postgres:secretpassword@localhost:5432/balancevault',
      };

      const sanitized = sanitize(sensitiveInput) as any;

      expect(sanitized.username).toBe('john_doe');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.nested.secret).toBe('[REDACTED]');
      expect(sanitized.nested.safeField).toBe('hello');
      expect(sanitized.connectionString).toBe('postgresql://postgres:[REDACTED]@localhost:5432/balancevault');
    });
  });
});
