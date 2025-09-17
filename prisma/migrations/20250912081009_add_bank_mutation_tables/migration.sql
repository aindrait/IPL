-- CreateTable
CREATE TABLE "bank_mutations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balance" REAL,
    "referenceNumber" TEXT,
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

-- CreateTable
CREATE TABLE "bank_mutation_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mutationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" REAL,
    "notes" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "previousMatchedPaymentId" TEXT,
    "newMatchedPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_mutation_verifications_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "bank_mutations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resident_bank_aliases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "residentId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "resident_bank_aliases_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "bank_mutations_uploadBatch_idx" ON "bank_mutations"("uploadBatch");

-- CreateIndex
CREATE INDEX "bank_mutations_transactionDate_idx" ON "bank_mutations"("transactionDate");

-- CreateIndex
CREATE INDEX "bank_mutations_amount_idx" ON "bank_mutations"("amount");

-- CreateIndex
CREATE INDEX "bank_mutations_isVerified_idx" ON "bank_mutations"("isVerified");

-- CreateIndex
CREATE INDEX "bank_mutation_verifications_mutationId_idx" ON "bank_mutation_verifications"("mutationId");

-- CreateIndex
CREATE INDEX "bank_mutation_verifications_verifiedBy_idx" ON "bank_mutation_verifications"("verifiedBy");

-- CreateIndex
CREATE INDEX "resident_bank_aliases_bankName_idx" ON "resident_bank_aliases"("bankName");

-- CreateIndex
CREATE UNIQUE INDEX "resident_bank_aliases_residentId_bankName_key" ON "resident_bank_aliases"("residentId", "bankName");
