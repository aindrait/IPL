-- CreateTable
CREATE TABLE "payment_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "verificationData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_verifications_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "payment_verifications_paymentId_idx" ON "payment_verifications"("paymentId");

-- CreateIndex
CREATE INDEX "payment_verifications_verifiedBy_idx" ON "payment_verifications"("verifiedBy");
