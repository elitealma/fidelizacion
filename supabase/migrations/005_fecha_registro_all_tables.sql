
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 005: fecha_registro TEXT en todas las tablas
-- + campos pendientes de migración 004
-- Formato esperado: 'YYYY-MM-DD HH:MM:SS' (hora Colombia)
-- Ejemplo: '2026-04-15 11:23:19'
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Campos pendientes de migración 004 (seguimientos_fidelizacion) ──
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_5d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_15d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_25d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_35d TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS resumen_llamada TEXT;

-- ── 2. Campo fecha_registro TEXT en TODAS las tablas ──
-- Formato: 'YYYY-MM-DD HH:MM:SS' (hora Bogotá, sin timezone)
-- Se llena automáticamente al insertar con la hora actual de Colombia

ALTER TABLE public.asesores ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_registro TEXT;
ALTER TABLE public.interacciones ADD COLUMN IF NOT EXISTS fecha_registro TEXT;

-- ── 3. Función para generar fecha Colombia en texto ──
CREATE OR REPLACE FUNCTION public.fn_fecha_bogota_text()
RETURNS TEXT AS $$
  SELECT to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS');
$$ LANGUAGE sql STABLE;

-- ── 4. Set default para fecha_registro en todas las tablas ──
ALTER TABLE public.asesores ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.clientes ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.pedidos ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();
ALTER TABLE public.interacciones ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();

-- ── 5. Llenar registros existentes que no tienen fecha_registro ──
UPDATE public.asesores SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.clientes SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.pedidos SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.seguimientos_fidelizacion SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;
UPDATE public.interacciones SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;

-- ── 6. Verificación ──
SELECT 'asesores' as tabla, count(*) as total, count(fecha_registro) as con_fecha FROM public.asesores
UNION ALL
SELECT 'clientes', count(*), count(fecha_registro) FROM public.clientes
UNION ALL
SELECT 'pedidos', count(*), count(fecha_registro) FROM public.pedidos
UNION ALL
SELECT 'seguimientos_fidelizacion', count(*), count(fecha_registro) FROM public.seguimientos_fidelizacion
UNION ALL
SELECT 'interacciones', count(*), count(fecha_registro) FROM public.interacciones;
