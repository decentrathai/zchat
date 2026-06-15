-- CreateTable
CREATE TABLE "AiAccount" (
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "balanceMicroUsd" BIGINT NOT NULL DEFAULT 0,
    "freeTrialGranted" BOOLEAN NOT NULL DEFAULT false,
    "pubkey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AiTopupDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zecTxId" TEXT NOT NULL,
    "zatoshi" BIGINT NOT NULL,
    "zecUsdPriceAtCredit" DECIMAL(20,8) NOT NULL,
    "microUsdCredited" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditedAt" TIMESTAMP(3),

    CONSTRAINT "AiTopupDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "veniceCostMicroUsd" BIGINT NOT NULL,
    "chargedMicroUsd" BIGINT NOT NULL,
    "marginMicroUsd" BIGINT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "veniceRequestId" TEXT,
    "errorCode" TEXT,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelPricing" (
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "inputPer1mUsd" DECIMAL(10,6) NOT NULL,
    "outputPer1mUsd" DECIMAL(10,6) NOT NULL,
    "imagePerCallUsd" DECIMAL(10,6),
    "isFreeTier" BOOLEAN NOT NULL DEFAULT false,
    "contextTokens" INTEGER,
    "privacy" TEXT NOT NULL,
    "supportsTools" BOOLEAN NOT NULL DEFAULT true,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelPricing_pkey" PRIMARY KEY ("modelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAccount_tokenHash_key" ON "AiAccount"("tokenHash");

-- CreateIndex
CREATE INDEX "AiAccount_tokenHash_idx" ON "AiAccount"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AiTopupDeposit_zecTxId_key" ON "AiTopupDeposit"("zecTxId");

-- CreateIndex
CREATE INDEX "AiTopupDeposit_userId_idx" ON "AiTopupDeposit"("userId");

-- CreateIndex
CREATE INDEX "AiTopupDeposit_status_idx" ON "AiTopupDeposit"("status");

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_ts_idx" ON "AiUsageEvent"("userId", "ts" DESC);

-- CreateIndex
CREATE INDEX "AiUsageEvent_ts_idx" ON "AiUsageEvent"("ts" DESC);

-- AddForeignKey
ALTER TABLE "AiTopupDeposit" ADD CONSTRAINT "AiTopupDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AiAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AiAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
