-- Prevent any code path from leaving AiAccount.balanceMicroUsd below zero.
-- Concurrent /ai/chat calls would otherwise race the application-layer gate.
-- Postgres raises error code 23514 (check_violation) on failed update.
ALTER TABLE "AiAccount"
  ADD CONSTRAINT "AiAccount_balanceMicroUsd_nonneg_check"
  CHECK ("balanceMicroUsd" >= 0);
