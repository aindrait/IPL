-- Script untuk inisialisasi database Supabase
-- Jalankan script ini di SQL Editor Supabase

-- 1. Membuat user admin
-- Password 'admin123' di-hash menggunakan bcrypt dengan salt rounds 12
-- Hash: $2b$12$Rn.nsrZqL4eMDsso/Q4wzOpCiDseSSV.pP7qNy8Fk0hzHwSMmXiq.
INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  'cuid_admin_001',
  'admin@example.com',
  'Admin User',
  '$2b$12$Rn.nsrZqL4eMDsso/Q4wzOpCiDseSSV.pP7qNy8Fk0hzHwSMmXiq.',
  'ADMIN',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 2. Membuat system user
INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt") 
VALUES (
  'cuid_system_001', 
  'system@localhost', 
  'System User', 
  '', 
  'ADMIN', 
  NOW(), 
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 3. Membuat default payment settings
INSERT INTO settings (id, key, value, "createdAt", "updatedAt") 
VALUES (
  'cuid_settings_001', 
  'paymentSettings', 
  '{"defaultAmount":250000,"dueDate":5,"rwSettings":{"activeRWs":[12],"defaultRW":12},"bankAccount":{"bank":"BCA","accountNumber":"6050613567","accountName":"YUPITHER BOUK"}}', 
  NOW(), 
  NOW()
) ON CONFLICT (key) DO NOTHING;

-- 4. Membuat contoh RW (RT/RW)
INSERT INTO rts (id, number, rw, chairman, phone, "isActive", "createdAt", "updatedAt") 
VALUES 
  ('cuid_rt_001', 1, 12, 'Ketua RT 01', '081234567890', true, NOW(), NOW()),
  ('cuid_rt_002', 2, 12, 'Ketua RT 02', '081234567891', true, NOW(), NOW()),
  ('cuid_rt_003', 3, 12, 'Ketua RT 03', '081234567892', true, NOW(), NOW()),
  ('cuid_rt_004', 4, 12, 'Ketua RT 04', '081234567893', true, NOW(), NOW()),
  ('cuid_rt_005', 5, 12, 'Ketua RT 05', '081234567894', true, NOW(), NOW())
ON CONFLICT (number, rw) DO NOTHING;

-- 5. Membuat contoh warga
INSERT INTO residents (id, name, address, phone, email, rt, rw, blok, houseNumber, "isActive", "createdAt", "updatedAt", "createdById") 
VALUES 
  ('cuid_resident_001', 'Ahmad Wijaya', 'Jl. Merdeka No. 1', '081234567890', 'ahmad@example.com', 1, 12, 'A', '1', true, NOW(), NOW(), 'cuid_admin_001'),
  ('cuid_resident_002', 'Siti Nurhaliza', 'Jl. Merdeka No. 2', '081234567891', 'siti@example.com', 1, 12, 'A', '2', true, NOW(), NOW(), 'cuid_admin_001'),
  ('cuid_resident_003', 'Budi Santoso', 'Jl. Merdeka No. 3', '081234567892', 'budi@example.com', 2, 12, 'B', '1', true, NOW(), NOW(), 'cuid_admin_001'),
  ('cuid_resident_004', 'Dewi Lestari', 'Jl. Merdeka No. 4', '081234567893', 'dewi@example.com', 2, 12, 'B', '2', true, NOW(), NOW(), 'cuid_admin_001'),
  ('cuid_resident_005', 'Eko Prasetyo', 'Jl. Merdeka No. 5', '081234567894', 'eko@example.com', 3, 12, 'C', '1', true, NOW(), NOW(), 'cuid_admin_001')
ON CONFLICT (phone) DO NOTHING;

-- 6. Membuat contoh periode pembayaran
INSERT INTO payment_periods (id, name, month, year, amount, "dueDate", "isActive", "createdAt", "updatedAt") 
VALUES 
  ('cuid_period_001', 'IPL Bulan Januari 2024', 1, 2024, 250000, '2024-01-05', true, NOW(), NOW()),
  ('cuid_period_002', 'IPL Bulan Februari 2024', 2, 2024, 250000, '2024-02-05', true, NOW(), NOW()),
  ('cuid_period_003', 'IPL Bulan Maret 2024', 3, 2024, 250000, '2024-03-05', true, NOW(), NOW()),
  ('cuid_period_004', 'THR 2024', 4, 2024, 500000, '2024-04-10', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 7. Membuat contoh jadwal pembayaran
INSERT INTO payment_schedules (id, name, description, "startDate", "endDate", "isActive", "periodId", "createdById", "createdAt", "updatedAt") 
VALUES 
  ('cuid_schedule_001', 'Jadwal Pembayaran Q1 2024', 'Jadwal pembayaran IPL untuk kuartal 1 tahun 2024', '2024-01-01', '2024-03-31', true, 'cuid_period_001', 'cuid_admin_001', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 8. Membuat contoh item jadwal pembayaran
INSERT INTO payment_schedule_items (id, type, status, amount, "dueDate", "scheduleId", "periodId", "residentId", "createdAt", "updatedAt") 
VALUES 
  ('cuid_schedule_item_001', 'MONTHLY', 'PLANNED', 250000, '2024-01-05', 'cuid_schedule_001', 'cuid_period_001', 'cuid_resident_001', NOW(), NOW()),
  ('cuid_schedule_item_002', 'MONTHLY', 'PLANNED', 250000, '2024-01-05', 'cuid_schedule_001', 'cuid_period_001', 'cuid_resident_002', NOW(), NOW()),
  ('cuid_schedule_item_003', 'MONTHLY', 'PLANNED', 250000, '2024-01-05', 'cuid_schedule_001', 'cuid_period_001', 'cuid_resident_003', NOW(), NOW()),
  ('cuid_schedule_item_004', 'MONTHLY', 'PLANNED', 250000, '2024-01-05', 'cuid_schedule_001', 'cuid_period_001', 'cuid_resident_004', NOW(), NOW()),
  ('cuid_schedule_item_005', 'MONTHLY', 'PLANNED', 250000, '2024-01-05', 'cuid_schedule_001', 'cuid_period_001', 'cuid_resident_005', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 9. Membuat contoh pembayaran
INSERT INTO payments (id, amount, "paymentDate", status, "paymentMethod", notes, "residentId", "createdById", "createdAt", "updatedAt") 
VALUES 
  ('cuid_payment_001', 250000, '2024-01-01', 'VERIFIED', 'Transfer Bank', 'Pembayaran IPL Januari 2024', 'cuid_resident_001', 'cuid_admin_001', NOW(), NOW()),
  ('cuid_payment_002', 250000, '2024-01-02', 'VERIFIED', 'Transfer Bank', 'Pembayaran IPL Januari 2024', 'cuid_resident_002', 'cuid_admin_001', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 10. Update status item jadwal pembayaran
UPDATE payment_schedule_items 
SET status = 'PAID', "paidDate" = '2024-01-01', "paymentId" = 'cuid_payment_001' 
WHERE id = 'cuid_schedule_item_001';

UPDATE payment_schedule_items 
SET status = 'PAID', "paidDate" = '2024-01-02', "paymentId" = 'cuid_payment_002' 
WHERE id = 'cuid_schedule_item_002';

-- 11. Membuat contoh bank mutation
INSERT INTO bank_mutations (
  id, "transactionDate", description, amount, "referenceNumber", "transactionType", 
  category, "isVerified", "verifiedAt", "verifiedBy", "matchedPaymentId", "matchedResidentId", 
  "matchScore", "matchingStrategy", "rawData", "uploadBatch", "fileName", "createdAt", "updatedAt"
) 
VALUES 
  (
    'cuid_mutation_001', 
    '2024-01-01 10:00:00', 
    'TRANSFER FROM AHMAD WIJAYA', 
    250000, 
    'REF001', 
    'CR', 
    'IPL', 
    true, 
    '2024-01-01 10:05:00', 
    'cuid_admin_001', 
    'cuid_payment_001', 
    'cuid_resident_001', 
    0.95, 
    'AUTO_MATCH', 
    '{"id": "REF001", "date": "2024-01-01", "description": "TRANSFER FROM AHMAD WIJAYA", "amount": 250000}', 
    'BATCH_001', 
    'bank_statement_jan.csv', 
    NOW(), 
    NOW()
  ),
  (
    'cuid_mutation_002', 
    '2024-01-02 11:00:00', 
    'TRANSFER FROM SITI NURHALIZA', 
    250000, 
    'REF002', 
    'CR', 
    'IPL', 
    true, 
    '2024-01-02 11:05:00', 
    'cuid_admin_001', 
    'cuid_payment_002', 
    'cuid_resident_002', 
    0.95, 
    'AUTO_MATCH', 
    '{"id": "REF002", "date": "2024-01-02", "description": "TRANSFER FROM SITI NURHALIZA", "amount": 250000}', 
    'BATCH_001', 
    'bank_statement_jan.csv', 
    NOW(), 
    NOW()
  )
ON CONFLICT DO NOTHING;

-- 12. Membuat contoh verifikasi pembayaran
INSERT INTO payment_verifications (
  id, "paymentId", "verifiedBy", "verificationMethod", status, notes, "verificationData", "createdAt", "updatedAt"
) 
VALUES 
  (
    'cuid_verification_001', 
    'cuid_payment_001', 
    'cuid_admin_001', 
    'BANK_STATEMENT', 
    'VERIFIED', 
    'Verifikasi melalui bank statement', 
    '{"confidence": 0.95, "matchedMutationId": "cuid_mutation_001"}', 
    NOW(), 
    NOW()
  ),
  (
    'cuid_verification_002', 
    'cuid_payment_002', 
    'cuid_admin_001', 
    'BANK_STATEMENT', 
    'VERIFIED', 
    'Verifikasi melalui bank statement', 
    '{"confidence": 0.95, "matchedMutationId": "cuid_mutation_002"}', 
    NOW(), 
    NOW()
  )
ON CONFLICT DO NOTHING;

-- 13. Membuat contoh bank aliases
INSERT INTO resident_bank_aliases (id, "residentId", "bankName", "isVerified", frequency, "lastSeen", "createdAt", "updatedAt") 
VALUES 
  ('cuid_alias_001', 'cuid_resident_001', 'AHMAD WIJAYA', true, 1, NOW(), NOW(), NOW()),
  ('cuid_alias_002', 'cuid_resident_002', 'SITI NURHALIZA', true, 1, NOW(), NOW(), NOW())
ON CONFLICT ("residentId", "bankName") DO NOTHING;

-- 14. Membuat contoh learning data
INSERT INTO verification_learning_data (
  id, "residentId", "namePatterns", "addressPatterns", "transactionPatterns", "confidenceScores", "lastUpdated", "createdAt", "updatedAt"
) 
VALUES 
  (
    'cuid_learning_001', 
    'cuid_resident_001', 
    '["AHMAD", "WIJAYA"]', 
    '["JL", "MERDEKA"]', 
    '["TRANSFER"]', 
    '{"nameMatching": 0.9, "addressMatching": 0.8, "transactionMatching": 0.95}', 
    NOW(), 
    NOW(), 
    NOW()
  ),
  (
    'cuid_learning_002', 
    'cuid_resident_002', 
    '["SITI", "NURHALIZA"]', 
    '["JL", "MERDEKA"]', 
    '["TRANSFER"]', 
    '{"nameMatching": 0.9, "addressMatching": 0.8, "transactionMatching": 0.95}', 
    NOW(), 
    NOW(), 
    NOW()
  )
ON CONFLICT ("residentId") DO NOTHING;

-- 15. Membuat contoh reminder
INSERT INTO reminders (
  id, type, message, "sentAt", status, "sentVia", "response", "residentId", "createdById", "createdAt", "updatedAt"
) 
VALUES 
  (
    'cuid_reminder_001', 
    'PAYMENT_DUE', 
    'Pengingat pembayaran IPL bulan Januari 2024', 
    '2024-01-01 09:00:00', 
    'SENT', 
    'whatsapp', 
    'Terima kasih atas pengingatnya', 
    'cuid_resident_001', 
    'cuid_admin_001', 
    NOW(), 
    NOW()
  ),
  (
    'cuid_reminder_002', 
    'PAYMENT_DUE', 
    'Pengingat pembayaran IPL bulan Januari 2024', 
    '2024-01-02 09:00:00', 
    'SENT', 
    'whatsapp', 
    'Terima kasih atas pengingatnya', 
    'cuid_resident_002', 
    'cuid_admin_001', 
    NOW(), 
    NOW()
  )
ON CONFLICT DO NOTHING;

-- 16. Membuat contoh bank mutation verification
INSERT INTO bank_mutation_verifications (
  id, "mutationId", action, confidence, notes, "verifiedBy", "previousMatchedPaymentId", "newMatchedPaymentId", "createdAt"
) 
VALUES 
  (
    'cuid_mutation_verification_001', 
    'cuid_mutation_001', 
    'AUTO_MATCH', 
    0.95, 
    'Auto-matched with payment', 
    'cuid_admin_001', 
    NULL, 
    'cuid_payment_001', 
    NOW()
  ),
  (
    'cuid_mutation_verification_002', 
    'cuid_mutation_002', 
    'AUTO_MATCH', 
    0.95, 
    'Auto-matched with payment', 
    'cuid_admin_001', 
    NULL, 
    'cuid_payment_002', 
    NOW()
  )
ON CONFLICT DO NOTHING;

-- 17. Membuat contoh payment proof
INSERT INTO payment_proofs (
  id, filename, "filePath", "fileSize", "mimeType", analyzed, "analysisResult", "paymentId", "createdAt"
) 
VALUES 
  (
    'cuid_proof_001', 
    'bukti_transfer_ahmad.jpg', 
    '/uploads/bukti_transfer_ahmad.jpg', 
    1024000, 
    'image/jpeg', 
    true, 
    '{"verified": true, "confidence": 0.9, "amount": 250000}', 
    'cuid_payment_001', 
    NOW()
  ),
  (
    'cuid_proof_002', 
    'bukti_transfer_siti.jpg', 
    '/uploads/bukti_transfer_siti.jpg', 
    1024000, 
    'image/jpeg', 
    true, 
    '{"verified": true, "confidence": 0.9, "amount": 250000}', 
    'cuid_payment_002', 
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Selesai
SELECT 'Database initialization completed successfully!' as message;