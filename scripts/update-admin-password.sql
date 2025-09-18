-- Script untuk memperbarui password admin
-- Jalankan script ini di SQL Editor Supabase jika login gagal

-- Update password untuk user admin@example.com
-- Password 'admin123' di-hash menggunakan bcrypt dengan salt rounds 12
-- Hash: $2b$12$Rn.nsrZqL4eMDsso/Q4wzOpCiDseSSV.pP7qNy8Fk0hzHwSMmXiq.
UPDATE users 
SET password = '$2b$12$Rn.nsrZqL4eMDsso/Q4wzOpCiDseSSV.pP7qNy8Fk0hzHwSMmXiq.', 
    "updatedAt" = NOW() 
WHERE email = 'admin@example.com';

-- Verifikasi update
SELECT id, email, name, role, "createdAt", "updatedAt" 
FROM users 
WHERE email = 'admin@example.com';

-- Selesai
SELECT 'Admin password updated successfully!' as message;