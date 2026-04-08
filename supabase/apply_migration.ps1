$token = "sbp_7c7769fb86137c8340d0428f7452eb3b6f0b330a"
$projectId = "rqucbsuafirnohhogdry"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json; charset=utf-8"
}
$uri = "https://api.supabase.com/v1/projects/$projectId/database/query"

function Run-SQL($label, $sql) {
    Write-Host "`n>>> $label" -ForegroundColor Cyan
    $bodyObj = @{ query = $sql }
    $jsonBody = $bodyObj | ConvertTo-Json -Depth 3 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    try {
        $resp = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $bytes -ContentType "application/json; charset=utf-8"
        Write-Host "    OK" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "    FALLO: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            Write-Host "    Detalle: $errBody" -ForegroundColor Yellow
        }
        return $false
    }
}

# ---------- PASO 1: ENUMS ----------
Run-SQL "ENUM etiqueta_cliente" "CREATE TYPE public.enum_etiqueta_cliente AS ENUM ('NUEVO','PERDIDO','OCASIONAL','RECURRENTE');"

Run-SQL "ENUM canal_adquisicion" "CREATE TYPE public.enum_canal_adquisicion AS ENUM ('ORGANICO','ANUNCIO','EVENTO');"

Run-SQL "ENUM area_ventas" "CREATE TYPE public.enum_area_ventas AS ENUM ('WHATSAPP','RED_SOCIAL','SHOPIFY');"

Run-SQL "ENUM estado_logistico" "CREATE TYPE public.enum_estado_logistico AS ENUM ('TODAS','GUIA_GENERADA','EN_REPARTO','EN_OFICINA','ENTREGADO_AL_CLIENTE','HABLAR_CON_ASESOR','RETRASO_O_MOLESTIA','NOVEDADES','GARANTIAS','DEVOLUCIONES');"

Run-SQL "ENUM calidad_seguimiento" "CREATE TYPE public.enum_calidad_seguimiento AS ENUM ('BUENO','REGULAR','CRITICO');"

# ---------- PASO 2: TABLA asesores ----------
Run-SQL "Tabla asesores" @"
CREATE TABLE IF NOT EXISTS public.asesores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'asesor',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"@

# ---------- PASO 3: TABLA clientes ----------
Run-SQL "Tabla clientes" @"
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  whatsapp TEXT NOT NULL CONSTRAINT chk_whatsapp_colombia CHECK (whatsapp ~ '^\+57[0-9]{10}$'),
  pais TEXT NOT NULL DEFAULT 'Colombia',
  departamento TEXT,
  ciudad TEXT,
  etiqueta public.enum_etiqueta_cliente NOT NULL DEFAULT 'NUEVO',
  canal_adquisicion public.enum_canal_adquisicion,
  ultima_compra TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"@

Run-SQL "Indice unico whatsapp" "CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes (whatsapp);"

# ---------- PASO 4: TABLA pedidos ----------
Run-SQL "Tabla pedidos" @"
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto TEXT NOT NULL,
  ticket_compra DECIMAL(12,2) NOT NULL DEFAULT 0,
  area_ventas public.enum_area_ventas NOT NULL DEFAULT 'WHATSAPP',
  estado_logistico public.enum_estado_logistico NOT NULL DEFAULT 'TODAS',
  fecha_pedido TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"@

Run-SQL "Indices pedidos" @"
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON public.pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_logistico ON public.pedidos (estado_logistico);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON public.pedidos (fecha_pedido DESC);
"@

# ---------- PASO 5: TABLA seguimientos_fidelizacion ----------
Run-SQL "Tabla seguimientos_fidelizacion" @"
CREATE TABLE IF NOT EXISTS public.seguimientos_fidelizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  asesor_id UUID NOT NULL REFERENCES public.asesores(id) ON DELETE RESTRICT,
  llamada_5d BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_15d BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_25d BOOLEAN NOT NULL DEFAULT FALSE,
  llamada_35d BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones TEXT,
  calidad public.enum_calidad_seguimiento,
  estado_tarea VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CONSTRAINT chk_estado_tarea CHECK (estado_tarea IN ('ACTIVA','COMPLETADA','ARCHIVADA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"@

Run-SQL "Indices seguimientos" @"
CREATE INDEX IF NOT EXISTS idx_seguimientos_pedido ON public.seguimientos_fidelizacion (pedido_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_asesor ON public.seguimientos_fidelizacion (asesor_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_estado ON public.seguimientos_fidelizacion (estado_tarea);
"@

# ---------- PASO 6: TRIGGER updated_at ----------
Run-SQL "Funcion updated_at" @"
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;
"@

Run-SQL "Trigger asesores" "CREATE TRIGGER trg_asesores_updated_at BEFORE UPDATE ON public.asesores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();"
Run-SQL "Trigger clientes" "CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();"
Run-SQL "Trigger pedidos" "CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();"
Run-SQL "Trigger seguimientos" "CREATE TRIGGER trg_seguimientos_updated_at BEFORE UPDATE ON public.seguimientos_fidelizacion FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();"

# ---------- PASO 7: RLS ----------
Run-SQL "RLS enable" @"
ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimientos_fidelizacion ENABLE ROW LEVEL SECURITY;
"@

# Politicas SELECT publico
Run-SQL "Policy SELECT asesores" "CREATE POLICY ""sel_asesores"" ON public.asesores FOR SELECT USING (true);"
Run-SQL "Policy SELECT clientes" "CREATE POLICY ""sel_clientes"" ON public.clientes FOR SELECT USING (true);"
Run-SQL "Policy SELECT pedidos" "CREATE POLICY ""sel_pedidos"" ON public.pedidos FOR SELECT USING (true);"
Run-SQL "Policy SELECT seguimientos" "CREATE POLICY ""sel_seguimientos"" ON public.seguimientos_fidelizacion FOR SELECT USING (true);"

# Politicas ALL authenticated
Run-SQL "Policy ALL auth asesores" "CREATE POLICY ""all_auth_asesores"" ON public.asesores FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');"
Run-SQL "Policy ALL auth clientes" "CREATE POLICY ""all_auth_clientes"" ON public.clientes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');"
Run-SQL "Policy ALL auth pedidos" "CREATE POLICY ""all_auth_pedidos"" ON public.pedidos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');"
Run-SQL "Policy ALL auth seguimientos" "CREATE POLICY ""all_auth_seguimientos"" ON public.seguimientos_fidelizacion FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');"

# Politicas ALL service_role
Run-SQL "Policy ALL service asesores" "CREATE POLICY ""all_svc_asesores"" ON public.asesores FOR ALL USING (auth.role() = 'service_role');"
Run-SQL "Policy ALL service clientes" "CREATE POLICY ""all_svc_clientes"" ON public.clientes FOR ALL USING (auth.role() = 'service_role');"
Run-SQL "Policy ALL service pedidos" "CREATE POLICY ""all_svc_pedidos"" ON public.pedidos FOR ALL USING (auth.role() = 'service_role');"
Run-SQL "Policy ALL service seguimientos" "CREATE POLICY ""all_svc_seguimientos"" ON public.seguimientos_fidelizacion FOR ALL USING (auth.role() = 'service_role');"

# ---------- PASO 8: GRANTS ----------
Run-SQL "Grants schema" "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;"
Run-SQL "Grants tables anon" "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;"
Run-SQL "Grants tables authenticated" "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;"
Run-SQL "Grants tables service_role" "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;"

Run-SQL "Default privileges anon" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;"
Run-SQL "Default privileges authenticated" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;"
Run-SQL "Default privileges service_role" "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;"

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  MIGRACION COMPLETA - CRM Elite Nutrition" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
