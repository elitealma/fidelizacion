
-- Crear función para ejecutar SQL dinámico via RPC
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE query;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Dar acceso solo al service_role
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;



-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 005: fecha_registro + campos pendientes
-- ═══════════════════════════════════════════════════════

-- Campos pendientes de mig004
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_5d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_15d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_25d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_35d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS resumen_llamada TEXT;

-- fecha_registro en TODAS las tablas
ALTER TABLE public.asesores ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.interacciones ADD COLUMN IF NOT EXISTS fecha_registro TEXT;

-- Función automática hora Colombia
CREATE OR REPLACE FUNCTION public.fn_fecha_bogota_text()
RETURNS TEXT AS $$
  SELECT to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS');
$$ LANGUAGE sql STABLE;

-- Defaults automáticos
ALTER TABLE public.asesores ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.clientes ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.pedidos ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.interacciones ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();

-- Llenar registros existentes
UPDATE public.asesores SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.clientes SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.pedidos SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.seguimientos_fidelizacion SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.interacciones SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
