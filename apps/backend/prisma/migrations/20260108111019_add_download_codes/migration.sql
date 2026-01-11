-- CreateTable
CREATE TABLE "DownloadCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "whitelistId" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DownloadCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadCode_code_key" ON "DownloadCode"("code");

-- AddForeignKey
ALTER TABLE "DownloadCode" ADD CONSTRAINT "DownloadCode_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
