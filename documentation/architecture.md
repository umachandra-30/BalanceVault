# BalanceVault — System Architecture & Design

> "Money movement with a ledger you can prove."

## 1. High-Level Architecture Overview

BalanceVault is built as a modular monorepo web platform engineered for verifiable financial integrity, role-based access control, and complete auditability.

```
                    ┌─────────────────────────────────────────┐
                    │          React + Vite Frontend          │
                    │      (Responsive Modern UI / SPA)       │
                    └────────────────────┬────────────────────┘
                                         │ HTTPS / REST (JSON)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │          Express.js API Gateway         │
                    │   - Security Headers (Helmet)           │
                    │   - Origin Controls (CORS)              │
                    │   - Centralized Error & 404 Handlers    │
                    │   - Sanitized Request Logging           │
                    │   - Zod Input & Environment Validation  │
                    │   - Rate Limiter (Brute-Force Guard)    │
                    └──────────────┬──────────────────┬───────┘
                                   │                  │
               Rate Limiting &     │                  │ Type-Safe Queries
               Transient State     ▼                  ▼ & Transactions
                       ┌───────────────┐     ┌────────────────────────┐
                       │  Redis Cache  │     │       Prisma ORM       │
                       │ (or Fallback) │     └───────────┬────────────┘
                       └───────────────┘                 │
                                                         ▼
                                             ┌────────────────────────┐
                                             │  PostgreSQL Database   │
                                             │  - Relational Schema   │
                                             │  - Double-Entry Ledger │
                                             │  - Audit Logs          │
                                             │  - Least-Privilege     │
                                             └────────────────────────┘
```

---

## 2. Authentication & Authorization Architecture (Phase 3)

### A. Password Security (Argon2id)
- Passwords are encrypted using **Argon2id** (`memoryCost: 64MB`, `timeCost: 3`, `parallelism: 1`).
- Passwords and password hashes are **never** returned in API responses and are automatically redacted by the structured logger.

### B. Dual Token Authentication (Access JWT + HttpOnly Refresh Cookie)
- **Access Token**: Short-lived JWT (`1d`) signed with `JWT_SECRET`. Contains minimal claims (`userId`, `email`, `role`, `status`). Accepted via `Authorization: Bearer <token>` or `accessToken` cookie.
- **Refresh Token**: Signed with `JWT_REFRESH_SECRET` and stored inside a hardened HttpOnly cookie:
  ```ts
  {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
  ```

### C. Role-Based Access Control (RBAC)
Endpoints are strictly protected using the `requireRole(...allowedRoles)` middleware:
- **`ADMIN`**: User management, reviewing onboarding applications, accessing global audit logs, managing account states.
- **`ACCOUNT_HOLDER`**: Managing personal accounts, viewing owned ledger entries and balances, initiating permitted deposits and transfers.
- **`AUDITOR`**: Strictly read-only access to permitted accounts, ledger entries, and audit logs. Mutation endpoints (`POST`, `PUT`, `DELETE`) are prohibited for auditors.

### D. Account Ownership Authorization
The `requireAccountOwnership(paramName)` middleware enforces ownership at the data layer:
- **Never trusts an account ID blindly**: Whenever an account ID is passed via URL parameters, request body, or query strings, the middleware verifies that the authenticated user actually owns that account.
- **Prevents Insecure Direct Object References (IDOR)**: If an account holder attempts to substitute an account ID belonging to another user, access is denied (`403 Forbidden`).
- **Role Differentiation**:
  - `ADMIN`: Granted administrative access.
  - `AUDITOR`: Granted access only on safe read-only HTTP methods (`GET`, `HEAD`). All mutating HTTP methods are rejected (`403 Forbidden`).
  - `ACCOUNT_HOLDER`: Strictly validated against `account.userId === req.user.id`.

### E. Rate Limiting Protection
- Sensitive authentication routes (`/api/v1/auth/login` and `/api/v1/auth/register`) are guarded by `authRateLimiter`.
- Limits requests to **10 attempts per 15-minute window** per client IP to mitigate credential stuffing and brute-force attacks.
- Returns `429 Too Many Requests` with a standard `Retry-After` header when triggered.
