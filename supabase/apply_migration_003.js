const https = require('https');
const TOKEN = 'sbp_7c7769fb86137c8340d0428f7452eb3b6f0b330a';
const PROJECT_ID = 'rqucbsuafirnohhogdry';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

function executeQuery(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = { method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) console.log(`  ✅ ${label}`);
        else console.log(`  ❌ ${label} (${res.statusCode}): ${data.substring(0, 300)}`);
        resolve(data);
      });
    });
    req.on('error', (err) => { console.log(`  ❌ ${label}: ${err.message}`); resolve(null); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('=== MIGRACIÓN 003: ENUMs a TEXT (campos libres) ===\n');
  console.log('Se mantienen como ENUM: etiqueta_cliente, estado_logistico\n');

  const changes = [
    // clientes.canal_adquisicion -> TEXT
    { label: 'clientes.canal_adquisicion → TEXT', sql: `ALTER TABLE public.clientes ALTER COLUMN canal_adquisicion TYPE TEXT;` },

    // pedidos.area_ventas -> TEXT
    { label: 'pedidos.area_ventas → TEXT', sql: `ALTER TABLE public.pedidos ALTER COLUMN area_ventas TYPE TEXT;` },

    // seguimientos_fidelizacion.calidad -> TEXT
    { label: 'seguimientos.calidad → TEXT', sql: `ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN calidad TYPE TEXT;` },

    // seguimientos_fidelizacion.prioridad -> TEXT
    { label: 'seguimientos.prioridad → TEXT', sql: `ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN prioridad TYPE TEXT;` },

    // interacciones.tipo -> TEXT
    { label: 'interacciones.tipo → TEXT', sql: `ALTER TABLE public.interacciones ALTER COLUMN tipo TYPE TEXT;` },

    // interacciones.motivo -> TEXT
    { label: 'interacciones.motivo → TEXT', sql: `ALTER TABLE public.interacciones ALTER COLUMN motivo TYPE TEXT;` },

    // interacciones.resultado -> TEXT
    { label: 'interacciones.resultado → TEXT', sql: `ALTER TABLE public.interacciones ALTER COLUMN resultado TYPE TEXT;` },

    // Recrear vista sin dependencia de enums
    { label: 'Drop vista v_resumen_interacciones', sql: `DROP VIEW IF EXISTS public.v_resumen_interacciones;` },
    { label: 'Recrear vista v_resumen_interacciones', sql: `CREATE OR REPLACE VIEW public.v_resumen_interacciones AS SELECT date_trunc('day', fecha_interaccion)::date AS dia, tipo, motivo, resultado, COUNT(*) AS total, COUNT(*) FILTER (WHERE resultado = 'EXITOSA') AS exitosas, COUNT(*) FILTER (WHERE fue_venta = true) AS ventas, COUNT(*) FILTER (WHERE tipo = 'WHATSAPP_PLANTILLA' AND whatsapp_respondido = true) AS whatsapp_respondidos FROM public.interacciones GROUP BY dia, tipo, motivo, resultado ORDER BY dia DESC;` },
    { label: 'Grant vista', sql: `GRANT SELECT ON public.v_resumen_interacciones TO anon, authenticated, service_role;` },

    // Drop unused enums (safe - no columns reference them anymore)
    { label: 'Drop enum_canal_adquisicion', sql: `DROP TYPE IF EXISTS public.enum_canal_adquisicion;` },
    { label: 'Drop enum_area_ventas', sql: `DROP TYPE IF EXISTS public.enum_area_ventas;` },
    { label: 'Drop enum_calidad_seguimiento', sql: `DROP TYPE IF EXISTS public.enum_calidad_seguimiento;` },
    { label: 'Drop enum_prioridad', sql: `DROP TYPE IF EXISTS public.enum_prioridad;` },
    { label: 'Drop enum_tipo_interaccion', sql: `DROP TYPE IF EXISTS public.enum_tipo_interaccion;` },
    { label: 'Drop enum_motivo_interaccion', sql: `DROP TYPE IF EXISTS public.enum_motivo_interaccion;` },
    { label: 'Drop enum_resultado_interaccion', sql: `DROP TYPE IF EXISTS public.enum_resultado_interaccion;` },

    // Set sensible defaults (TEXT)
    { label: 'Default calidad', sql: `ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN calidad SET DEFAULT 'BUENO';` },
    { label: 'Default prioridad', sql: `ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN prioridad SET DEFAULT 'MEDIA';` },
    { label: 'Default resultado', sql: `ALTER TABLE public.interacciones ALTER COLUMN resultado SET DEFAULT 'PENDIENTE';` },
  ];

  for (const q of changes) {
    await executeQuery(q.label, q.sql);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n── Verificación ──');
  await executeQuery('Tipos columnas', `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('canal_adquisicion','area_ventas','calidad','prioridad','tipo','motivo','resultado') AND table_name IN ('clientes','pedidos','seguimientos_fidelizacion','interacciones') ORDER BY table_name, column_name;`);

  console.log('\n=== MIGRACIÓN 003 COMPLETA ===');
}

main().catch(console.error);
