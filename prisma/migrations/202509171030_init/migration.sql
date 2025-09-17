-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "rt" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "blok" TEXT,
    "houseNumber" TEXT,
    "paymentIndex" INTEGER,
    "ownership" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "rtId" TEXT,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analysisResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentVia" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_items" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MONTHLY',
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "paymentId" TEXT,

    CONSTRAINT "payment_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rts" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "chairman" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_verifications" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "verificationData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_mutations" (
    "id" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION,
    "referenceNumber" TEXT,
    "transactionType" TEXT,
    "category" TEXT,
    "isOmitted" BOOLEAN NOT NULL DEFAULT false,
    "omitReason" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "matchedPaymentId" TEXT,
    "matchedResidentId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "matchingStrategy" TEXT,
    "rawData" TEXT NOT NULL,
    "uploadBatch" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_mutation_verifications" (
    "id" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "previousMatchedPaymentId" TEXT,
    "newMatchedPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_mutation_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_bank_aliases" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resident_bank_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_learning_data" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "namePatterns" TEXT NOT NULL,
    "addressPatterns" TEXT NOT NULL,
    "transactionPatterns" TEXT NOT NULL,
    "confidenceScores" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_learning_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "residents_phone_key" ON "residents"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "residents_paymentIndex_key" ON "residents"("paymentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "rts_number_rw_key" ON "rts"("number", "rw");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "verification_learning_data_residentId_key" ON "verification_learning_data"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "resident_bank_aliases_residentId_bankName_key" ON "resident_bank_aliases"("residentId", "bankName");

-- CreateIndex
CREATE INDEX "payment_schedule_items_residentId_idx" ON "payment_schedule_items"("residentId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_periodId_idx" ON "payment_schedule_items"("periodId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_scheduleId_idx" ON "payment_schedule_items"("scheduleId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_paymentId_idx" ON "payment_schedule_items"("paymentId");

-- CreateIndex
CREATE INDEX "payment_verifications_paymentId_idx" ON "payment_verifications"("paymentId");

-- CreateIndex
CREATE INDEX "payment_verifications_verifiedBy_idx" ON "payment_verifications"("verifiedBy");

-- CreateIndex
CREATE INDEX "bank_mutations_uploadBatch_idx" ON "bank_mutations"("uploadBatch");

-- CreateIndex
CREATE INDEX "bank_mutations_transactionDate_idx" ON "bank_mutations"("transactionDate");

-- CreateIndex
CREATE INDEX "bank_mutations_amount_idx" ON "bank_mutations"("amount");

-- CreateIndex
CREATE INDEX "bank_mutations_isVerified_idx" ON "bank_mutations"("isVerified");

-- CreateIndex
CREATE INDEX "bank_mutations_transactionType_idx" ON "bank_mutations"("transactionType");

-- CreateIndex
CREATE INDEX "bank_mutations_category_idx" ON "bank_mutations"("category");

-- CreateIndex
CREATE INDEX "bank_mutations_isOmitted_idx" ON "bank_mutations"("isOmitted");

-- CreateIndex
CREATE INDEX "bank_mutation_verifications_mutationId_idx" ON "bank_mutation_verifications"("mutationId");

-- CreateIndex
CREATE INDEX "bank_mutation_verifications_verifiedBy_idx" ON "bank_mutation_verifications"("verifiedBy");

-- CreateIndex
CREATE INDEX "resident_bank_aliases_bankName_idx" ON "resident_bank_aliases"("bankName");

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_rtId_fkey" FOREIGN KEY ("rtId") REFERENCES "rts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_verifications" ADD CONSTRAINT "payment_verifications_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_matchedResidentId_fkey" FOREIGN KEY ("matchedResidentId") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_mutation_verifications" ADD CONSTRAINT "bank_mutation_verifications_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "bank_mutations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_bank_aliases" ADD CONSTRAINT "resident_bank_aliases_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;