-- =====================================================
-- OPTIMIZATION SCRIPT: Dashboard Query Performance
-- Add composite indexes for frequently used query patterns
-- =====================================================

-- Composite index for payment_schedule_items queries used in dashboard
-- This index optimizes the overdue calculations that filter on:
-- period_id, status, due_date, and payment_id
CREATE INDEX IF NOT EXISTS "payment_schedule_items_period_status_due_payment_idx" 
ON "payment_schedule_items"("period_id", "status", "due_date", "payment_id");

-- Composite index for resident queries by RT/RW
-- This optimizes the resident lookups when calculating overdue by RT/RW
CREATE INDEX IF NOT EXISTS "residents_rt_rw_active_idx" 
ON "residents"("rt", "rw", "is_active");

-- Composite index for payment_schedule_items by resident and period
-- This optimizes queries looking for specific resident's schedule items in a period
CREATE INDEX IF NOT EXISTS "payment_schedule_items_resident_period_status_idx" 
ON "payment_schedule_items"("resident_id", "period_id", "status");

-- Composite index for payments with status and date
-- This optimizes the recent payments and income aggregation queries
CREATE INDEX IF NOT EXISTS "payments_status_date_idx" 
ON "payments"("status", "created_at");

-- Composite index for payment_schedule_items overdue queries
-- This is specifically for the overdue calculations that check:
-- period_id, status (not PAID), due_date (past), and payment (null)
CREATE INDEX IF NOT EXISTS "payment_schedule_items_overdue_idx" 
ON "payment_schedule_items"("period_id", "status", "due_date") 
WHERE "status" != 'PAID' AND "payment_id" IS NULL;

-- Index for residents with active status only
CREATE INDEX IF NOT EXISTS "residents_active_idx" 
ON "residents"("is_active") WHERE "is_active" = true;

-- Composite index for payment periods with active status and date
CREATE INDEX IF NOT EXISTS "payment_periods_active_month_year_idx" 
ON "payment_periods"("is_active", "month", "year", "due_date");

-- =====================================================
-- PERFORMANCE ANALYSIS QUERIES
-- =====================================================

-- Query to check index usage after optimization
SELECT
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname IN ('payment_schedule_items', 'residents', 'payments', 'payment_periods')
ORDER BY idx_scan DESC;

-- Query to analyze slow queries (run this during dashboard load)
-- Note: This requires pg_stat_statements extension to be enabled
-- Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT
    query,
    calls,
    total_exec_time as total_time,
    mean_exec_time as mean_time,
    min_exec_time as min_time,
    max_exec_time as max_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%payment_schedule_items%'
   OR query LIKE '%residents%'
   OR query LIKE '%dashboard%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- =====================================================
-- END OF OPTIMIZATION SCRIPT
-- =====================================================