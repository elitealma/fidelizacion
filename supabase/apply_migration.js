const https = require('https');

const TOKEN = 'sbp_7c7769fb86137c8340d0428f7452eb3b6f0b330a';
const PROJECT_ID = 'rqucbsuafirnohhogdry';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

const queries = [
  // ENUMS
  { label: 'ENUM etiqueta_cliente', sql: `CREATE TYPE public.enum_etiqueta_cliente AS ENUM ('NUEVO','PERDIDO','OCASIONAL','RECURRENTE');` },
  { label: 'ENUM canal_adquisicion', sql: `CREATE TYPE public.enum_canal_adquisicion AS ENUM ('ORGANICO','ANUNCIO','EVENTO');` },
  { label: 'ENUM area_ventas', sql: `CREATE TYPE public.enum_area_ventas AS ENUM ('WHATSAPP','RED_SOCIAL','SHOPIFY');` },
  { label: 'ENUM estado_logistico', sql: `CREATE TYPE public.enum_estado_logistico AS ENUM ('TODAS','GUIA_GENERADA','EN_REPARTO','EN_OFICINA','ENTREGADO_AL_CLIENTE','HABLAR_CON_ASESOR','RETRASO_O_MOLESTIA','NOVEDADES','GARANTIAS','DEVOLUCIONES');` },
  { label: 'ENUM calidad_seguimiento', sql: `CREATE TYPE public.enum_calidad_seguimiento AS ENUM ('BUENO','REGULAR','CRITICO');` },

  // TABLA asesores
  { label: 'Tabla asesores', sql: `CREATE TABLE IF NOT EXISTS public.asesores (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nombre_completo TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'asesor', activo BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` },

  // TABLA clientes
  { label: 'Tabla clientes', sql: `CREATE TABLE IF NOT EXISTS public.clientes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nombre_completo TEXT NOT NULL, whatsapp TEXT NOT NULL CONSTRAINT chk_whatsapp_colombia CHECK (whatsapp ~ '^\\+57[0-9]{10}$'), pais TEXT NOT NULL DEFAULT 'Colombia', departamento TEXT, ciudad TEXT, etiqueta public.enum_etiqueta_cliente NOT NULL DEFAULT 'NUEVO', canal_adquisicion public.enum_canal_adquisicion, ultima_compra TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` },
  { label: 'Indice whatsapp', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes (whatsapp);` },

  // TABLA pedidos
  { label: 'Tabla pedidos', sql: `CREATE TABLE IF NOT EXISTS public.pedidos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE, producto TEXT NOT NULL, ticket_compra DECIMAL(12,2) NOT NULL DEFAULT 0, area_ventas public.enum_area_ventas NOT NULL DEFAULT 'WHATSAPP', estado_logistico public.enum_estado_logistico NOT NULL DEFAULT 'TODAS', fecha_pedido TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` },
  { label: 'Indices pedidos 1', sql: `CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON public.pedidos (cliente_id);` },
  { label: 'Indices pedidos 2', sql: `CREATE INDEX IF NOT EXISTS idx_pedidos_estado_logistico ON public.pedidos (estado_logistico);` },
  { label: 'Indices pedidos 3', sql: `CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON public.pedidos (fecha_pedido DESC);` },

  // TABLA seguimientos_fidelizacion
  { label: 'Tabla seguimientos', sql: `CREATE TABLE IF NOT EXISTS public.seguimientos_fidelizacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE, asesor_id UUID NOT NULL REFERENCES public.asesores(id) ON DELETE RESTRICT, llamada_5d BOOLEAN NOT NULL DEFAULT FALSE, llamada_15d BOOLEAN NOT NULL DEFAULT FALSE, llamada_25d BOOLEAN NOT NULL DEFAULT FALSE, llamada_35d BOOLEAN NOT NULL DEFAULT FALSE, observaciones TEXT, calidad public.enum_calidad_seguimiento, estado_tarea VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CONSTRAINT chk_estado_tarea CHECK (estado_tarea IN ('ACTIVA','COMPLETADA','ARCHIVADA')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` },
  { label: 'Indices seg 1', sql: `CREATE INDEX IF NOT EXISTS idx_seguimientos_pedido ON public.seguimientos_fidelizacion (pedido_id);` },
  { label: 'Indices seg 2', sql: `CREATE INDEX IF NOT EXISTS idx_seguimientos_asesor ON public.seguimientos_fidelizacion (asesor_id);` },
  { label: 'Indices seg 3', sql: `CREATE INDEX IF NOT EXISTS idx_seguimientos_estado ON public.seguimientos_fidelizacion (estado_tarea);` },

  // TRIGGER updated_at
  { label: 'Funcion updated_at', sql: `CREATE OR REPLACE FUNCTION public.fn_set_updated_at() RETURNS TRIGGER AS $body$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $body$ LANGUAGE plpgsql;` },
  { label: 'Trigger asesores', sql: `CREATE TRIGGER trg_asesores_updated_at BEFORE UPDATE ON public.asesores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();` },
  { label: 'Trigger clientes', sql: `CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();` },
  { label: 'Trigger pedidos', sql: `CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();` },
  { label: 'Trigger seguimientos', sql: `CREATE TRIGGER trg_seguimientos_updated_at BEFORE UPDATE ON public.seguimientos_fidelizacion FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();` },

  // RLS
  { label: 'RLS enable', sql: `ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY; ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY; ALTER TABLE public.seguimientos_fidelizacion ENABLE ROW LEVEL SECURITY;` },

  // Policies SELECT
  { label: 'Policy SEL asesores', sql: `CREATE POLICY "sel_asesores" ON public.asesores FOR SELECT USING (true);` },
  { label: 'Policy SEL clientes', sql: `CREATE POLICY "sel_clientes" ON public.clientes FOR SELECT USING (true);` },
  { label: 'Policy SEL pedidos', sql: `CREATE POLICY "sel_pedidos" ON public.pedidos FOR SELECT USING (true);` },
  { label: 'Policy SEL seguimientos', sql: `CREATE POLICY "sel_seguimientos" ON public.seguimientos_fidelizacion FOR SELECT USING (true);` },

  // Policies ALL authenticated
  { label: 'Policy AUTH asesores', sql: `CREATE POLICY "all_auth_asesores" ON public.asesores FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');` },
  { label: 'Policy AUTH clientes', sql: `CREATE POLICY "all_auth_clientes" ON public.clientes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');` },
  { label: 'Policy AUTH pedidos', sql: `CREATE POLICY "all_auth_pedidos" ON public.pedidos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');` },
  { label: 'Policy AUTH seguimientos', sql: `CREATE POLICY "all_auth_seguimientos" ON public.seguimientos_fidelizacion FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');` },

  // Policies ALL service_role
  { label: 'Policy SVC asesores', sql: `CREATE POLICY "all_svc_asesores" ON public.asesores FOR ALL USING (auth.role() = 'service_role');` },
  { label: 'Policy SVC clientes', sql: `CREATE POLICY "all_svc_clientes" ON public.clientes FOR ALL USING (auth.role() = 'service_role');` },
  { label: 'Policy SVC pedidos', sql: `CREATE POLICY "all_svc_pedidos" ON public.pedidos FOR ALL USING (auth.role() = 'service_role');` },
  { label: 'Policy SVC seguimientos', sql: `CREATE POLICY "all_svc_seguimientos" ON public.seguimientos_fidelizacion FOR ALL USING (auth.role() = 'service_role');` },

  // GRANTS
  { label: 'Grants schema', sql: `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;` },
  { label: 'Grants anon', sql: `GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;` },
  { label: 'Grants authenticated', sql: `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;` },
  { label: 'Grants service_role', sql: `GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;` },
  { label: 'Default priv anon', sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;` },
  { label: 'Default priv auth', sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;` },
  { label: 'Default priv svc', sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;` },
];

function executeQuery(label, sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✅ ${label}`);
          resolve(data);
        } else {
          console.log(`  ❌ ${label} (HTTP ${res.statusCode}): ${data.substring(0, 200)}`);
          resolve(data); // Continue even on error
        }
      });
    });

    req.on('error', (err) => {
      console.log(`  ❌ ${label}: ${err.message}`);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('  MIGRACION CRM Elite Nutrition');
  console.log('========================================\n');

  for (const q of queries) {
    await executeQuery(q.label, q.sql);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n========================================');
  console.log('  VERIFICACION FINAL');
  console.log('========================================\n');

  // Verify tables
  const tablesResp = await executeQuery('Verificar tablas', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('  Tablas:', tablesResp);

  // Verify enums
  const enumsResp = await executeQuery('Verificar enums', "SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');");
  console.log('  Enums:', enumsResp);
}

main().catch(console.error);
