BEGIN;

-- CreateTable
CREATE TABLE "LeadMagnetResponse" (
    "id" TEXT NOT NULL,
    "leadMagnetId" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "source" TEXT,
    "campaign" TEXT,
    "resultJson" TEXT,
    "whatsappClickedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadMagnetResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadMagnetResponse_leadMagnetId_createdAt_idx" ON "LeadMagnetResponse"("leadMagnetId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadMagnetResponse_leadMagnetId_status_createdAt_idx" ON "LeadMagnetResponse"("leadMagnetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LeadMagnetResponse_leadMagnetId_campaign_idx" ON "LeadMagnetResponse"("leadMagnetId", "campaign");

-- AddForeignKey
ALTER TABLE "LeadMagnetResponse" ADD CONSTRAINT "LeadMagnetResponse_leadMagnetId_fkey" FOREIGN KEY ("leadMagnetId") REFERENCES "LeadMagnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
