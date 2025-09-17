-- CreateTable
CREATE TABLE "verification_learning_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "residentId" TEXT NOT NULL,
    "namePatterns" TEXT NOT NULL,
    "addressPatterns" TEXT NOT NULL,
    "transactionPatterns" TEXT NOT NULL,
    "confidenceScores" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bank_mutations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balance" REAL,
    "referenceNumber" TEXT,
    "transactionType" TEXT,
    "category" TEXT,
    "isOmitted" BOOLEAN NOT NULL DEFAULT false,
    "omitReason" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "matchedPaymentId" TEXT,
    "matchedResidentId" TEXT,
    "matchScore" REAL,
    "matchingStrategy" TEXT,
    "rawData" TEXT NOT NULL,
    "uploadBatch" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bank_mutations_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bank_mutations_matchedResidentId_fkey" FOREIGN KEY ("matchedResidentId") REFERENCES "residents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_bank_mutations" ("amount", "balance", "createdAt", "description", "fileName", "id", "isVerified", "matchScore", "matchedPaymentId", "matchedResidentId", "matchingStrategy", "rawData", "referenceNumber", "transactionDate", "transactionType", "updatedAt", "uploadBatch", "verifiedAt", "verifiedBy") SELECT "amount", "balance", "createdAt", "description", "fileName", "id", "isVerified", "matchScore", "matchedPaymentId", "matchedResidentId", "matchingStrategy", "rawData", "referenceNumber", "transactionDate", "transactionType", "updatedAt", "uploadBatch", "verifiedAt", "verifiedBy" FROM "bank_mutations";
DROP TABLE "bank_mutations";
ALTER TABLE "new_bank_mutations" RENAME TO "bank_mutations";
CREATE INDEX "bank_mutations_uploadBatch_idx" ON "bank_mutations"("uploadBatch");
CREATE INDEX "bank_mutations_transactionDate_idx" ON "bank_mutations"("transactionDate");
CREATE INDEX "bank_mutations_amount_idx" ON "bank_mutations"("amount");
CREATE INDEX "bank_mutations_isVerified_idx" ON "bank_mutations"("isVerified");
CREATE INDEX "bank_mutations_transactionType_idx" ON "bank_mutations"("transactionType");
CREATE INDEX "bank_mutations_category_idx" ON "bank_mutations"("category");
CREATE INDEX "bank_mutations_isOmitted_idx" ON "bank_mutations"("isOmitted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "verification_learning_data_residentId_key" ON "verification_learning_data"("residentId");
