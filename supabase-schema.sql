-- Supabase Database Schema for UniConv
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PLANS TABLE
-- ============================================
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    max_file_size_bytes BIGINT NOT NULL DEFAULT 350000000, -- 350MB default
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, max_file_size_bytes) VALUES 
    ('Free', 350000000),      -- 350MB
    ('Pro', 1073741824),      -- 1GB
    ('Premium', 0)            -- 0 = unlimited
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    storage_used_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Admins can do everything (handled by service role)

-- ============================================
-- FILES TABLE
-- ============================================
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Users can view their own files
CREATE POLICY "Users can view own files" ON files
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own files
CREATE POLICY "Users can insert own files" ON files
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own files
CREATE POLICY "Users can delete own files" ON files
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================
-- PROCESSING JOBS TABLE
-- ============================================
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tool TEXT NOT NULL,
    input_file_ids UUID[] NOT NULL DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    result_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs" ON processing_jobs
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own jobs
CREATE POLICY "Users can insert own jobs" ON processing_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own jobs
CREATE POLICY "Users can update own jobs" ON processing_jobs
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- These need to be created in Supabase Dashboard > Storage
-- 1. Create bucket "uploads" (public: false)
-- 2. Create bucket "results" (public: false)

-- Storage policies for "uploads" bucket:
-- Users can upload to their own folder
-- CREATE POLICY "Users can upload to uploads" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own uploads
-- CREATE POLICY "Users can read own uploads" ON storage.objects
--     FOR SELECT USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for "results" bucket:
-- Users can read their own results
-- CREATE POLICY "Users can read own results" ON storage.objects
--     FOR SELECT USING (bucket_id = 'results' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role can do everything (for backend processing)

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for processing_jobs table
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);