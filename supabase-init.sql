-- =====================================================
-- INIT SCRIPT: PostgreSQL (Supabase) - IPL Master
-- Create tables dengan snake_case field names
-- =====================================================

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 2. RESIDENTS TABLE
-- =====================================================
CREATE TABLE "residents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "rt" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "blok" TEXT,
    "house_number" TEXT,
    "payment_index" INTEGER,
    "ownership" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "rt_id" TEXT,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 3. PAYMENT_PERIODS TABLE
-- =====================================================
CREATE TABLE "payment_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_periods_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 4. PAYMENTS TABLE
-- =====================================================
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resident_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 5. PAYMENT_PROOFS TABLE
-- =====================================================
CREATE TABLE "payment_proofs" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analysis_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_id" TEXT NOT NULL,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 6. REMINDERS TABLE
-- =====================================================
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_via" TEXT,
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resident_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 7. PAYMENT_SCHEDULES TABLE
-- =====================================================
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "period_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 8. PAYMENT_SCHEDULE_ITEMS TABLE
-- =====================================================
CREATE TABLE "payment_schedule_items" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MONTHLY',
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "resident_id" TEXT NOT NULL,
    "payment_id" TEXT,

    CONSTRAINT "payment_schedule_items_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 9. RTS TABLE
-- =====================================================
CREATE TABLE "rts" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "chairman" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rts_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 10. PAYMENT_VERIFICATIONS TABLE
-- =====================================================
CREATE TABLE "payment_verifications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "verified_by" TEXT NOT NULL,
    "verification_method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "verification_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_verifications_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 11. SETTINGS TABLE
-- =====================================================
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 12. BANK_MUTATIONS TABLE
-- =====================================================
CREATE TABLE "bank_mutations" (
    "id" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION,
    "reference_number" TEXT,
    "transaction_type" TEXT,
    "category" TEXT,
    "is_omitted" BOOLEAN NOT NULL DEFAULT false,
    "omit_reason" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "matched_payment_id" TEXT,
    "matched_resident_id" TEXT,
    "match_score" DOUBLE PRECISION,
    "matching_strategy" TEXT,
    "raw_data" TEXT NOT NULL,
    "upload_batch" TEXT NOT NULL,
    "file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_mutations_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 13. BANK_MUTATION_VERIFICATIONS TABLE
-- =====================================================
CREATE TABLE "bank_mutation_verifications" (
    "id" TEXT NOT NULL,
    "mutation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "verified_by" TEXT NOT NULL,
    "previous_matched_payment_id" TEXT,
    "new_matched_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_mutation_verifications_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 14. RESIDENT_BANK_ALIASES TABLE
-- =====================================================
CREATE TABLE "resident_bank_aliases" (
    "id" TEXT NOT NULL,
    "resident_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resident_bank_aliases_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 15. VERIFICATION_LEARNING_DATA TABLE
-- =====================================================
CREATE TABLE "verification_learning_data" (
    "id" TEXT NOT NULL,
    "resident_id" TEXT NOT NULL,
    "name_patterns" TEXT NOT NULL,
    "address_patterns" TEXT NOT NULL,
    "transaction_patterns" TEXT NOT NULL,
    "confidence_scores" TEXT NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_learning_data_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- UNIQUE INDEXES
-- =====================================================
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "residents_phone_key" ON "residents"("phone");
CREATE UNIQUE INDEX "residents_payment_index_key" ON "residents"("payment_index");
CREATE UNIQUE INDEX "rts_number_rw_key" ON "rts"("number", "rw");
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
CREATE UNIQUE INDEX "verification_learning_data_resident_id_key" ON "verification_learning_data"("resident_id");
CREATE UNIQUE INDEX "resident_bank_aliases_resident_id_bank_name_key" ON "resident_bank_aliases"("resident_id", "bank_name");

-- =====================================================
-- REGULAR INDEXES
-- =====================================================
CREATE INDEX "payment_schedule_items_resident_id_idx" ON "payment_schedule_items"("resident_id");
CREATE INDEX "payment_schedule_items_period_id_idx" ON "payment_schedule_items"("period_id");
CREATE INDEX "payment_schedule_items_schedule_id_idx" ON "payment_schedule_items"("schedule_id");
CREATE INDEX "payment_schedule_items_payment_id_idx" ON "payment_schedule_items"("payment_id");
CREATE INDEX "payment_verifications_payment_id_idx" ON "payment_verifications"("payment_id");
CREATE INDEX "payment_verifications_verified_by_idx" ON "payment_verifications"("verified_by");
CREATE INDEX "bank_mutations_upload_batch_idx" ON "bank_mutations"("upload_batch");
CREATE INDEX "bank_mutations_transaction_date_idx" ON "bank_mutations"("transaction_date");
CREATE INDEX "bank_mutations_amount_idx" ON "bank_mutations"("amount");
CREATE INDEX "bank_mutations_is_verified_idx" ON "bank_mutations"("is_verified");
CREATE INDEX "bank_mutations_transaction_type_idx" ON "bank_mutations"("transaction_type");
CREATE INDEX "bank_mutations_category_idx" ON "bank_mutations"("category");
CREATE INDEX "bank_mutations_is_omitted_idx" ON "bank_mutations"("is_omitted");
CREATE INDEX "bank_mutation_verifications_mutation_id_idx" ON "bank_mutation_verifications"("mutation_id");
CREATE INDEX "bank_mutation_verifications_verified_by_idx" ON "bank_mutation_verifications"("verified_by");
CREATE INDEX "resident_bank_aliases_bank_name_idx" ON "resident_bank_aliases"("bank_name");

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================
ALTER TABLE "residents" ADD CONSTRAINT "residents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "residents" ADD CONSTRAINT "residents_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_verifications" ADD CONSTRAINT "payment_verifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_matched_payment_id_fkey" FOREIGN KEY ("matched_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_matched_resident_id_fkey" FOREIGN KEY ("matched_resident_id") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_mutation_verifications" ADD CONSTRAINT "bank_mutation_verifications_mutation_id_fkey" FOREIGN KEY ("mutation_id") REFERENCES "bank_mutations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resident_bank_aliases" ADD CONSTRAINT "resident_bank_aliases_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Cek apakah semua tabel berhasil dibuat
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'residents', 'payments', 'payment_proofs', 
        'reminders', 'payment_schedules', 'payment_schedule_items',
        'rts', 'payment_verifications', 'settings', 'bank_mutations',
        'bank_mutation_verifications', 'resident_bank_aliases',
        'verification_learning_data'
    )
    AND column_name LIKE '%_%'  -- Hanya kolom dengan snake_case
ORDER BY table_name, column_name;

-- =====================================================
-- END OF INIT SCRIPT
-- =====================================================
