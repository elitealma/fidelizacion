const https = require('https');
const TOKEN = 'sbp_514d264aaf76f29e54e25356fd1e70897b20a90f';
const PROJECT_ID = 'rqucbsuafirnohhogdry';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

function q(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(API_URL, opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) console.log(`  ✅ ${label}`);
        else console.log(`  ❌ ${label} (${res.statusCode}): ${d.substring(0, 250)}`);
        resolve(d);
      });
    });
    req.on('error', e => { console.log(`  ❌ ${label}: ${e.message}`); resolve(null); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('=== FIX: interacciones columns + drop old enums ===\n');

  // Step 1: Drop the view that depends on interacciones columns
  await q('Drop vista v_resumen_interacciones', "DROP VIEW IF EXISTS public.v_resumen_interacciones;");
  await new Promise(r => setTimeout(r, 600));

  // Step 2: Drop defaults that depend on old enums
  await q('Drop default area_ventas', "ALTER TABLE public.pedidos ALTER COLUMN area_ventas DROP DEFAULT;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop default prioridad', "ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN prioridad DROP DEFAULT;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop default resultado', "ALTER TABLE public.interacciones ALTER COLUMN resultado DROP DEFAULT;");
  await new Promise(r => setTimeout(r, 400));

  // Step 3: Now ALTER the interacciones columns
  await q('interacciones.tipo → TEXT', "ALTER TABLE public.interacciones ALTER COLUMN tipo TYPE TEXT;");
  await new Promise(r => setTimeout(r, 500));
  await q('interacciones.motivo → TEXT', "ALTER TABLE public.interacciones ALTER COLUMN motivo TYPE TEXT;");
  await new Promise(r => setTimeout(r, 500));
  await q('interacciones.resultado → TEXT', "ALTER TABLE public.interacciones ALTER COLUMN resultado TYPE TEXT;");
  await new Promise(r => setTimeout(r, 500));

  // Step 4: Re-set defaults as TEXT
  await q('Default area_ventas', "ALTER TABLE public.pedidos ALTER COLUMN area_ventas SET DEFAULT 'WHATSAPP';");
  await new Promise(r => setTimeout(r, 400));
  await q('Default prioridad', "ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN prioridad SET DEFAULT 'MEDIA';");
  await new Promise(r => setTimeout(r, 400));
  await q('Default resultado', "ALTER TABLE public.interacciones ALTER COLUMN resultado SET DEFAULT 'PENDIENTE';");
  await new Promise(r => setTimeout(r, 500));

  // Step 5: Drop old ENUMs
  console.log('\n── Drop ENUMs viejos ──');
  await q('Drop enum_area_ventas', "DROP TYPE IF EXISTS public.enum_area_ventas;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop enum_prioridad', "DROP TYPE IF EXISTS public.enum_prioridad;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop enum_tipo_interaccion', "DROP TYPE IF EXISTS public.enum_tipo_interaccion;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop enum_motivo_interaccion', "DROP TYPE IF EXISTS public.enum_motivo_interaccion;");
  await new Promise(r => setTimeout(r, 400));
  await q('Drop enum_resultado_interaccion', "DROP TYPE IF EXISTS public.enum_resultado_interaccion;");
  await new Promise(r => setTimeout(r, 500));

  // Step 6: Recrear vista
  console.log('\n── Recrear vista ──');
  await q('Crear vista', "CREATE OR REPLACE VIEW public.v_resumen_interacciones AS SELECT date_trunc('day', fecha_interaccion)::date AS dia, tipo, motivo, resultado, COUNT(*) AS total, COUNT(*) FILTER (WHERE resultado = 'EXITOSA') AS exitosas, COUNT(*) FILTER (WHERE fue_venta = true) AS ventas, COUNT(*) FILTER (WHERE tipo = 'WHATSAPP_PLANTILLA' AND whatsapp_respondido = true) AS whatsapp_respondidos FROM public.interacciones GROUP BY dia, tipo, motivo, resultado ORDER BY dia DESC;");
  await new Promise(r => setTimeout(r, 400));
  await q('Grant vista', "GRANT SELECT ON public.v_resumen_interacciones TO anon, authenticated, service_role;");
  await new Promise(r => setTimeout(r, 500));

  // Step 7: Verificar
  console.log('\n── Verificación Final ──');
  const result = await q('Tipos de columnas', "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('canal_adquisicion','area_ventas','calidad','prioridad','tipo','motivo','resultado') AND table_name IN ('clientes','pedidos','seguimientos_fidelizacion','interacciones') ORDER BY table_name, column_name;");
  try { const p = JSON.parse(result); console.log('\n  Resultado:'); p.forEach(r => console.log(`    ${r.table_name}.${r.column_name} = ${r.data_type}`)); } catch(e) {}

  // Check remaining types
  const types = await q('ENUMs restantes', "SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e' ORDER BY typname;");
  try { const p = JSON.parse(types); console.log('\n  ENUMs que quedan (solo fijos):'); p.forEach(r => console.log(`    ✅ ${r.typname}`)); } catch(e) {}

  console.log('\n=== MIGRACIÓN 003 COMPLETA ===');
}

main().catch(console.error);
