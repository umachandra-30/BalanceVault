# BalanceVault

> "Money movement with a ledger you can prove."

BalanceVault is an enterprise-grade secure account management and money movement platform with an immutable double-entry ledger, atomic transactions, role-based access control (ADMIN, ACCOUNT_HOLDER, AUDITOR), and comprehensive audit trails.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, React Router, Axios, Lucide Icons, Modern CSS Design System
- **Backend**: Node.js, Express.js, TypeScript, Centralized Error Handling, Zod Validation, Helmet Security
- **Database**: PostgreSQL, Prisma ORM, Explicit Least-Privilege Database Roles
- **Security**: Argon2 Password Hashing, JWT (HttpOnly Cookies), RBAC, Redis-based Rate Limiting, Audit Logging
- **Accounting Architecture**: Double-entry bookkeeping (balanced debits & credits, atomic DB transactions, idempotency keys, race condition protection)

---

## 🚀 Getting Started (Windows Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested with v22+)
- **PostgreSQL**: v14+ (Local PostgreSQL 18 service running on Windows default port 5432)
- **Redis**: v6+ (Optional for early local dev, required for distributed rate-limiting):
  - *Option A (Recommended for Windows)*: Install [Memurai](https://www.memurai.com/) — a native Windows-compatible Redis developer edition.
  - *Option B (WSL2)*: Run `wsl sudo service redis-server start` on port 6379.
  - *Option C (Cloud)*: Free Upstash Redis or Redis Cloud instance.
  *(Note: BalanceVault includes an in-memory fallback adapter so backend development continues smoothly if Redis is temporarily offline).*

### 2. Environment Setup
1. Backend configuration:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Frontend configuration:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

### 3. Running the Backend
```bash
cd backend
npm install
npm run dev
```
The API starts at `http://localhost:5000`.
- Health check: `http://localhost:5000/api/v1/health`
- Readiness check: `http://localhost:5000/api/v1/ready`

### 4. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
The client starts at `http://localhost:5173`.

### 5. Running Tests
```bash
cd backend
npm test
```

---

## 🗺️ Implementation Roadmap

- [x] **Phase 1: Project Architecture & Environment Initialization, Backend & Frontend Skeletons, and Health Check Verification**
- [ ] **Phase 2: Database Modeling, Prisma Schema & Migrations, Ledger Architecture (Double-Entry Design), and Least-Privilege DB Roles**
- [ ] **Phase 3: Authentication & Authorization Engine (Argon2, JWT/HttpOnly Cookies, RBAC for ADMIN, ACCOUNT_HOLDER, AUDITOR, and Rate Limiting)**
- [ ] **Phase 4: Account Management & Onboarding Flow (Account creation, KYC/status review by Admin, Account Ownership Validation)**
- [ ] **Phase 5: Financial Engine & Double-Entry Ledger Implementation (Deposits, Withdrawals, Transfers with Concurrency Locking & Idempotency)**
- [ ] **Phase 6: Auditor Module & Audit Logging System (Read-only ledger exploration, Immutable audit trail, Filtering & Export)**
- [ ] **Phase 7: Frontend Application & UI Design System (React + Vite, Role-based Dashboard, Responsive financial views, Transfer/Deposit/Withdrawal flows)**
- [ ] **Phase 8: End-to-End Integration, Security Hardening, Verification & Documentation**
