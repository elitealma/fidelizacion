-- ============================================================
-- MIGRACIÓN 001: CRM y Fidelización - Elite Nutrition Colombia
-- Proyecto Supabase: FACTURACION AUTOMATICA (rqucbsuafirnohhogdry)
-- Fecha: 2026-04-08
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.enum_etiqueta_cliente AS ENUM (
    'NUEVO', 'PERDIDO', 'OCASIONAL', 'RECURRENTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_canal_adquisicion AS ENUM (
    'ORGANICO', 'ANUNCIO', 'EVENTO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_area_ventas AS ENUM (
    'WHATSAPP', 'RED_SOCIAL', 'SHOPIFY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_estado_logistico AS ENUM (
    'TODAS',
    'GUIA_GENERADA',
    'EN_REPARTO',
    'EN_OFICINA',
    'ENTREGADO_AL_CLIENTE',
    'HABLAR_CON_ASESOR',
    'RETRASO_O_MOLESTIA',
    'NOVEDADES',
    'GARANTIAS',
    'DEVOLUCIONES'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_calidad_seguimiento AS ENUM (
    'BUENO', 'REGULAR', 'CRITICO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- 2. TABLA: asesores
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asesores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'asesor',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asesores IS 'Asesores de ventas y fidelización de Elite Nutrition';


-- ────────────────────────────────────────────────────────────
-- 3. TABLA: clientes
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo   TEXT NOT NULL,
  whatsapp          TEXT NOT NULL
    CONSTRAINT chk_whatsapp_colombia CHECK (whatsapp ~ '^\+57[0-9]{10}$'),
  pais              TEXT NOT NULL DEFAULT 'Colombia',
  departamento      TEXT,
  ciudad            TEXT,
  etiqueta          public.enum_etiqueta_cliente NOT NULL DEFAULT 'NUEVO',
  canal_adquisicion public.enum_canal_adquisicion,
  ultima_compra     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clientes IS 'Clientes de Elite Nutrition con prefijo obligatorio +57 (Colombia)';
COMMENT ON COLUMN public.clientes.whatsapp IS 'Número WhatsApp con formato obligatorio +57XXXXXXXXXX';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes (whatsapp);


-- ────────────────────────────────────────────────────────────
-- 4. TABLA: pedidos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pedidos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto         TEXT NOT NULL,
  ticket_compra    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  area_ventas      public.enum_area_ventas NOT NULL DEFAULT 'WHATSAPP',
  estado_logistico public.enum_estado_logistico NOT NULL DEFAULT 'TODAS',
  fecha_pedido     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedidos IS 'Pedidos de clientes con trazabilidad logística';

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON public.pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_logistico ON public.pedidos (estado_logistico);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON public.pedidos (fecha_pedido DESC);


-- ────────────────────────────────────────────────────────────
-- 5. TABLA: seguimientos_fidelizacion
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seguimientos_fidelizacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  asesor_id       UUID NOT NULL REFERENCES public.asesores(id) ON DELETE RESTRICT,
  llamada_5d      BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_15d     BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_25d     BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_35d     BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones   TEXT,
  calidad         public.enum_calidad_seguimiento,
  estado_tarea    VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
    CONSTRAINT chk_estado_tarea CHECK (estado_tarea IN ('ACTIVA', 'COMPLETADA', 'ARCHIVADA')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.seguimientos_fidelizacion IS 'Seguimiento de llamadas post-venta (5d, 15d, 25d, 35d)';

CREATE INDEX IF NOT EXISTS idx_seguimientos_pedido ON public.seguimientos_fidelizacion (pedido_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_asesor ON public.seguimientos_fidelizacion (asesor_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_estado ON public.seguimientos_fidelizacion (estado_tarea);


-- ────────────────────────────────────────────────────────────
-- 6. TRIGGER: updated_at automático
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_asesores_updated_at
    BEFORE UPDATE ON public.asesores
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_pedidos_updated_at
    BEFORE UPDATE ON public.pedidos
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_seguimientos_updated_at
    BEFORE UPDATE ON public.seguimientos_fidelizacion
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas
ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimientos_fidelizacion ENABLE ROW LEVEL SECURITY;

-- Política: permitir lectura pública (anon + authenticated) para todas las tablas
CREATE POLICY "Lectura pública asesores"
  ON public.asesores FOR SELECT
  USING (true);

CREATE POLICY "Lectura pública clientes"
  ON public.clientes FOR SELECT
  USING (true);

CREATE POLICY "Lectura pública pedidos"
  ON public.pedidos FOR SELECT
  USING (true);

CREATE POLICY "Lectura pública seguimientos"
  ON public.seguimientos_fidelizacion FOR SELECT
  USING (true);

-- Política: permitir INSERT/UPDATE/DELETE solo a usuarios autenticados
CREATE POLICY "Escritura autenticada asesores"
  ON public.asesores FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Escritura autenticada clientes"
  ON public.clientes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Escritura autenticada pedidos"
  ON public.pedidos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Escritura autenticada seguimientos"
  ON public.seguimientos_fidelizacion FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Política: permitir acceso completo al service_role (para n8n/backend)
CREATE POLICY "Service role completo asesores"
  ON public.asesores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role completo clientes"
  ON public.clientes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role completo pedidos"
  ON public.pedidos FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role completo seguimientos"
  ON public.seguimientos_fidelizacion FOR ALL
  USING (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 8. GRANTS (permisos para roles de Supabase)
-- ────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Asegurar permisos en tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- ============================================================
-- FIN DE MIGRACIÓN 001
-- ============================================================
