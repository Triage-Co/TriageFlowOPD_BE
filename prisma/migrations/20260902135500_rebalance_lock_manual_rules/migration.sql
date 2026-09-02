-- AlterTable
ALTER TABLE "queue" ADD COLUMN IF NOT EXISTS "rebalance_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "queue" ADD COLUMN IF NOT EXISTS "manual_rule_codes" JSONB;

-- AlterTable
ALTER TABLE "visit_session" ADD COLUMN IF NOT EXISTS "manual_rule_codes" JSONB;
