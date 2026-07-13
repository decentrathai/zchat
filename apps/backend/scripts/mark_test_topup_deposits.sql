-- mark_test_topup_deposits.sql
--
-- PURPOSE: The AiTopupDeposit ledger contains ~7 fabricated dev-test rows (injected
-- 2026-05-21 while CREDIT_REQUIRE_ONCHAIN_VERIFY was off) with non-hex txids like
-- 'test-deposit-…', 'retest2-…', 'r1-…', 'rebind-test-…', 'rebind-v2-…', 'preflight-…'.
-- They inflate naive SUM() totals ~24x ($121.55 claimed vs ~$5 real).
--
-- This script MARKS them as status='test' — it NEVER deletes rows (preserve-tracking rule).
-- Real Zcash txids are exactly 64 lowercase hex chars, which cleanly separates real rows.
--
-- SAFETY:
--   * Marking is idempotent (re-running is a no-op).
--   * No re-credit risk: the backend's idempotency is keyed on the zecTxId @unique
--     constraint, NOT on status, so the watcher can never re-credit a marked row.
--   * Side effect to be aware of: the free-trial gate checks for a deposit with
--     status='credited', so the 7 TEST AiAccounts revert to trial-restricted. That is
--     correct — they never paid.
--
-- HOW TO RUN (on moltbot, against the zchat-postgres Docker container):
--   docker exec -i zchat-postgres psql -U <user> -d <db> < mark_test_topup_deposits.sql
--
-- Run STEP 0 first and sanity-check that exactly the expected test rows (7) are listed
-- before committing STEP 1.

-- ============================================================================
-- STEP 0 — PREVIEW (read-only): rows that would be marked as test
-- ============================================================================
SELECT id, "userId", "zecTxId", zatoshi, "microUsdCredited", status, "createdAt"
FROM "AiTopupDeposit"
WHERE status = 'credited'
  AND "zecTxId" !~ '^[0-9a-f]{64}$'
ORDER BY "createdAt";

-- ============================================================================
-- STEP 1 — MARK (transactional; no deletes)
-- ============================================================================
BEGIN;

UPDATE "AiTopupDeposit"
SET status = 'test'
WHERE status = 'credited'
  AND "zecTxId" !~ '^[0-9a-f]{64}$';

-- Expect: UPDATE 7 (or 0 on re-run). If the count surprises you: ROLLBACK;
COMMIT;

-- ============================================================================
-- STEP 2 — REAL totals (read-only): credited, non-test, genuine 64-hex txids
-- ============================================================================
SELECT COUNT(*)                                        AS real_deposits,
       COALESCE(SUM(zatoshi), 0)                       AS real_zatoshi,
       ROUND(COALESCE(SUM(zatoshi), 0)::numeric / 1e8, 8)          AS real_zec,
       COALESCE(SUM("microUsdCredited"), 0)            AS real_micro_usd,
       ROUND(COALESCE(SUM("microUsdCredited"), 0)::numeric / 1e6, 2) AS real_usd_collected
FROM "AiTopupDeposit"
WHERE status = 'credited'
  AND "zecTxId" ~ '^[0-9a-f]{64}$';

-- Test rows broken out separately, for the record:
SELECT COUNT(*)                                        AS test_deposits,
       COALESCE(SUM(zatoshi), 0)                       AS test_zatoshi,
       ROUND(COALESCE(SUM("microUsdCredited"), 0)::numeric / 1e6, 2) AS test_usd_marked
FROM "AiTopupDeposit"
WHERE status = 'test';

-- ============================================================================
-- STEP 3 — OPTIONAL (commented out — decide separately): zero the balances of the
-- 7 TEST AiAccounts so deposits and outstanding liability stay consistent.
-- These accounts were credited fabricated dollars; their balanceMicroUsd inflates
-- SUM(AiAccount.balanceMicroUsd) (liability) by ~$116.52 + trial remainders.
-- Left commented out per the "ask before touching balances" rule.
-- ============================================================================
-- BEGIN;
-- UPDATE "AiAccount" a
-- SET "balanceMicroUsd" = 0
-- WHERE EXISTS (
--   SELECT 1 FROM "AiTopupDeposit" d
--   WHERE d."userId" = a."userId" AND d.status = 'test'
-- )
-- AND NOT EXISTS (
--   SELECT 1 FROM "AiTopupDeposit" d
--   WHERE d."userId" = a."userId" AND d.status = 'credited'
-- );
-- COMMIT;
