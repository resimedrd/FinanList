-- ==============================================================================
-- Script SQL para FinanList: Eliminación Completa de Cuenta de Usuario
-- ==============================================================================
-- Ejecuta este script en el "SQL Editor" de tu proyecto de Supabase.
-- Esta función permite que los usuarios autenticados eliminen de forma definitiva
-- todos sus datos asociados y su cuenta del sistema de autenticación (auth.users),
-- permitiéndoles volver a registrarse posteriormente con el mismo correo electrónico.
-- ==============================================================================

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Obtener el ID del usuario actualmente autenticado
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado. Se requiere un usuario autenticado.';
  END IF;

  -- 1. Eliminar datos financieros y de configuración del usuario
  DELETE FROM public.transactions WHERE user_id = current_user_id;
  DELETE FROM public.recurring WHERE user_id = current_user_id;
  DELETE FROM public.debts WHERE user_id = current_user_id;
  DELETE FROM public.budgets WHERE user_id = current_user_id;
  DELETE FROM public.goals WHERE user_id = current_user_id;
  DELETE FROM public.financial_notifications WHERE user_id = current_user_id;
  DELETE FROM public.cards WHERE user_id = current_user_id;
  DELETE FROM public.categories WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;

  -- 2. Eliminar al usuario del sistema de autenticación de Supabase (auth.users)
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Conceder permisos de ejecución para que los usuarios autenticados puedan llamar esta función
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
