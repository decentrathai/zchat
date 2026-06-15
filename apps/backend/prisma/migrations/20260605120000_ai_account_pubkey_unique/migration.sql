-- Schema added `pubkey String? @unique` after the initial ai_credit_ledger migration
-- was generated, so the unique index was never written to SQL. Live prod DB had it
-- created out-of-band via `prisma db push`, but fresh deploys (CI, new envs) would
-- silently start without uniqueness enforcement — letting two wallets collide on
-- the same pubkey hash and bypass the per-pubkey rebind-cooldown rate limit.
--
-- Idempotent: IF NOT EXISTS skips on the already-synced production DB while
-- creating the index on any fresh deploy.
CREATE UNIQUE INDEX IF NOT EXISTS "AiAccount_pubkey_key" ON "AiAccount"("pubkey");
