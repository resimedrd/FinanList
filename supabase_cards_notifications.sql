-- ==============================================================================
-- Script SQL para FinanList: Migración de Tarjetas Financieras y Notificaciones
-- ==============================================================================
-- Ejecuta este script en el "SQL Editor" de tu proyecto de Supabase.
-- Crea las tablas 'cards' y 'financial_notifications' y actualiza 'transactions',
-- configurando las políticas de seguridad por fila (RLS) para proteger los datos
-- de cada usuario.
-- ==============================================================================

-- 1. Actualizar tabla transactions con los campos de asociación de tarjetas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'card_id') THEN
    ALTER TABLE public.transactions ADD COLUMN card_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'destination_card_id') THEN
    ALTER TABLE public.transactions ADD COLUMN destination_card_id text;
  END IF;
END $$;

-- 2. Crear tabla cards
CREATE TABLE IF NOT EXISTS public.cards (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank text NOT NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  last_four_digits text,
  currency text NOT NULL DEFAULT 'RD$',
  color text NOT NULL DEFAULT '#4f46e5',
  is_active boolean NOT NULL DEFAULT true,

  -- Campos para tarjetas de débito
  initial_balance numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  min_balance_alert numeric,
  allow_overdraft boolean DEFAULT false,
  overdraft_limit numeric DEFAULT 0,

  -- Campos para tarjetas de crédito
  credit_limit numeric DEFAULT 0,
  balance_used numeric DEFAULT 0,
  alert_threshold_percent integer DEFAULT 80,
  billing_cutoff_day integer DEFAULT 15,
  payment_due_day integer DEFAULT 5,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS en cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para cards
DROP POLICY IF EXISTS "Los usuarios pueden ver únicamente sus propias tarjetas" ON public.cards;
CREATE POLICY "Los usuarios pueden ver únicamente sus propias tarjetas"
  ON public.cards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propias tarjetas" ON public.cards;
CREATE POLICY "Los usuarios pueden insertar sus propias tarjetas"
  ON public.cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propias tarjetas" ON public.cards;
CREATE POLICY "Los usuarios pueden actualizar sus propias tarjetas"
  ON public.cards FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propias tarjetas" ON public.cards;
CREATE POLICY "Los usuarios pueden eliminar sus propias tarjetas"
  ON public.cards FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Crear tabla financial_notifications
CREATE TABLE IF NOT EXISTS public.financial_notifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text,
  card_name text,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'danger', 'info')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en financial_notifications
ALTER TABLE public.financial_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para financial_notifications
DROP POLICY IF EXISTS "Los usuarios pueden ver únicamente sus propias notificaciones" ON public.financial_notifications;
CREATE POLICY "Los usuarios pueden ver únicamente sus propias notificaciones"
  ON public.financial_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propias notificaciones" ON public.financial_notifications;
CREATE POLICY "Los usuarios pueden insertar sus propias notificaciones"
  ON public.financial_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propias notificaciones" ON public.financial_notifications;
CREATE POLICY "Los usuarios pueden actualizar sus propias notificaciones"
  ON public.financial_notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propias notificaciones" ON public.financial_notifications;
CREATE POLICY "Los usuarios pueden eliminar sus propias notificaciones"
  ON public.financial_notifications FOR DELETE
  USING (auth.uid() = user_id);
