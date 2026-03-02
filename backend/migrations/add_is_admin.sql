-- Migration: Add is_admin column to users table
-- Run: psql -U novapress -d novapress_db -f migrations/add_is_admin.sql
-- Or via Docker: docker exec -i novapress-postgres psql -U novapress -d novapress_db -f /tmp/add_is_admin.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'is_admin';
