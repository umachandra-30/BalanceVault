-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'SUCCESS';

-- CreateIndex
CREATE INDEX "audit_logs_outcome_idx" ON "audit_logs"("outcome");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");
