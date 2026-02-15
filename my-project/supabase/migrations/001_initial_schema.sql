-- =============================================================================
-- PackageBackEnd - Initial Database Schema
-- =============================================================================
-- This migration creates all tables, indexes, and RLS policies for the
-- PackageBackEnd application as defined in app_spec.txt.
--
-- Run this against your Supabase project via the SQL Editor or CLI.
-- Supabase URL: https://rkkyhhxcsqwyxwrpfrle.supabase.co
-- =============================================================================

-- Enable UUID extension (should already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CLINICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  uic TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  rank TEXT,
  uic TEXT,
  role TEXT NOT NULL DEFAULT 'medic' CHECK (role IN ('medic', 'supervisor', 'dev')),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- NOTES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_name TEXT,
  rank TEXT,
  uic TEXT,
  algorithm_reference TEXT,
  hpi_encoded TEXT,
  is_imported BOOLEAN NOT NULL DEFAULT FALSE,
  source_device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- NULL means active; non-NULL means soft-deleted
);

-- Index for querying active notes by user
CREATE INDEX IF NOT EXISTS idx_notes_user_active
  ON public.notes(user_id)
  WHERE deleted_at IS NULL;

-- Index for querying notes by clinic
CREATE INDEX IF NOT EXISTS idx_notes_clinic_active
  ON public.notes(clinic_id)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- TRAINING COMPLETIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.training_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_item_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure one completion record per user per training item
  UNIQUE(user_id, training_item_id)
);

-- =============================================================================
-- SYNC QUEUE TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed'))
);

-- Index for querying pending sync items
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
  ON public.sync_queue(user_id, status)
  WHERE status = 'pending';

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_completions_updated_at
  BEFORE UPDATE ON public.training_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, created_at, updated_at)
  VALUES (NEW.id, 'medic', NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: automatically create a profile when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Supervisors can read profiles in their clinic
CREATE POLICY "Supervisors can read clinic profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('supervisor', 'dev')
      AND p.clinic_id IS NOT NULL
      AND p.clinic_id = public.profiles.clinic_id
    )
  );

-- ---- CLINICS ----
-- Authenticated users can read clinics
CREATE POLICY "Authenticated users can read clinics"
  ON public.clinics FOR SELECT
  USING (auth.role() = 'authenticated');

-- Dev role can create/update clinics
CREATE POLICY "Dev can manage clinics"
  ON public.clinics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
    )
  );

-- ---- NOTES ----
-- Users can read their own notes (excluding soft-deleted)
CREATE POLICY "Users can read own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can read notes in their clinic
CREATE POLICY "Users can read clinic notes"
  ON public.notes FOR SELECT
  USING (
    deleted_at IS NULL
    AND clinic_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.clinic_id = notes.clinic_id
    )
  );

-- Users can create their own notes
CREATE POLICY "Users can create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (soft-delete) their own notes
CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- ---- TRAINING COMPLETIONS ----
-- Users can CRUD their own completions
CREATE POLICY "Users can manage own training"
  ON public.training_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Supervisors can read completions in their clinic
CREATE POLICY "Supervisors can read clinic training"
  ON public.training_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS supervisor
      WHERE supervisor.id = auth.uid()
      AND supervisor.role IN ('supervisor', 'dev')
      AND supervisor.clinic_id IS NOT NULL
      AND supervisor.clinic_id = (
        SELECT p.clinic_id FROM public.profiles AS p
        WHERE p.id = training_completions.user_id
      )
    )
  );

-- ---- SYNC QUEUE ----
-- Users can only access their own sync records
CREATE POLICY "Users can manage own sync queue"
  ON public.sync_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
