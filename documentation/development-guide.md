# BalanceVault — Developer Guide & Setup

## 1. Prerequisites
- **Node.js**: v18.0.0 or later (v22 recommended)
- **PostgreSQL**: v14.0 or later (running locally on port 5432)
- **Redis**: Optional for early development; in-memory fallback enabled by default.

---

## 2. Quickstart Commands

### Install all dependencies (Monorepo root):
```bash
npm install
```

### Run Backend API Service:
```bash
# Terminal 1
cd backend
npm run dev
```
The backend starts on `http://localhost:5000`.

### Run Frontend Client:
```bash
# Terminal 2
cd frontend
npm run dev
```
The frontend starts on `http://localhost:5173`.

### Run Backend Automated Tests:
```bash
cd backend
npm test
```

---

## 3. Database Migration Commands
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

---

## 4. API Endpoints Available in Phase 1
- `GET /api/v1/health` — Service liveness check (returns `200` with uptime and status).
- `GET /api/v1/ready` — Service readiness check (returns memory statistics and Redis connection status).

