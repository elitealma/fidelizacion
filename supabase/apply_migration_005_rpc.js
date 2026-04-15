const https = require('https');

const PROJECT_REF = 'rqucbsuafirnohhogdry';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';
const HOST = `${PROJECT_REF}.supabase.co`;

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        let ok = res.statusCode >= 200 && res.statusCode < 300;
        let parsed = null;
        try { parsed = JSON.parse(d); } catch(e) {}
        if (ok && parsed && parsed.success === false) {
          console.log(`  ⚠️  ${label}: ${parsed.error}`);
        } else if (ok) {
          console.log(`  ✅ ${label}`);
        } else {
          console.log(`  ❌ ${label} (HTTP ${res.statusCode}): ${d.substring(0, 150)}`);
        }
        resolve({ ok, data: parsed || d });
      });
    });
    req.on('error', e => { console.log(`  ❌ ${label}: ${e.message}`); resolve({ ok: false }); });
    req.write(body); req.end();
  });
}

function restGet(path) {
  return new Promise((resolve) => {
    const opts = {
      hostname: HOST, path, method: 'GET',
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', e => resolve({ status: 0, data: e.message }));
    req.end();
  });
}

async function main() {
  console.log('════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN 005 via exec_sql RPC');
  console.log('════════════════════════════════════════════════════\n');

  // Test exec_sql
  console.log('── [0] Test exec_sql ──');
  const test = await execSQL('SELECT 1', "SELECT 1;");
  if (!test.ok) { console.log('  ❌ exec_sql no funciona. Abortando.'); return; }

  // Campos pendientes mig004
  console.log('\n── [1] Campos pendientes mig004 ──');
  await execSQL('fecha_5d',  "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_5d TEXT;");
  await execSQL('fecha_15d', "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_15d TEXT;");
  await execSQL('fecha_25d', "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_25d TEXT;");
  await execSQL('fecha_35d', "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS fecha_35d TEXT;");
  await execSQL('resumen_llamada', "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS resumen_llamada TEXT;");

  // fecha_registro en todas las tablas
  console.log('\n── [2] fecha_registro en TODAS las tablas ──');
  const tables = ['asesores', 'clientes', 'pedidos', 'seguimientos_fidelizacion', 'interacciones'];
  for (const t of tables) {
    await execSQL(`${t}.fecha_registro`, `ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS fecha_registro TEXT;`);
  }

  // Función hora Colombia
  console.log('\n── [3] Función fn_fecha_bogota_text ──');
  await execSQL('fn_fecha_bogota_text', `
    CREATE OR REPLACE FUNCTION public.fn_fecha_bogota_text()
    RETURNS TEXT AS $fn$
      SELECT to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS');
    $fn$ LANGUAGE sql STABLE;
  `);

  // Defaults
  console.log('\n── [4] Defaults automáticos ──');
  for (const t of tables) {
    await execSQL(`Default ${t}`, `ALTER TABLE public.${t} ALTER COLUMN fecha_registro SET DEFAULT public.fn_fecha_bogota_text();`);
  }

  // Llenar existentes
  console.log('\n── [5] Llenando registros existentes ──');
  for (const t of tables) {
    await execSQL(`Update ${t}`, `UPDATE public.${t} SET fecha_registro = to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') WHERE fecha_registro IS NULL;`);
  }

  // Verificación
  console.log('\n── [6] Verificación final ──');
  for (const t of tables) {
    const r = await restGet(`/rest/v1/${t}?select=id,fecha_registro&limit=2`);
    if (r.status >= 200 && r.status < 300) {
      try {
        const rows = JSON.parse(r.data);
        if (rows.length > 0) {
          console.log(`  ✅ ${t}: fecha_registro = "${rows[0].fecha_registro}"`);
        } else {
          console.log(`  ℹ️  ${t}: tabla vacía`);
        }
      } catch(e) { console.log(`  ⚠️  ${t}: ${r.data.substring(0,80)}`); }
    }
  }

  // Verificar seguimientos con nuevas columnas
  const segR = await restGet('/rest/v1/seguimientos_fidelizacion?select=id,fecha_5d,fecha_15d,fecha_25d,fecha_35d,resumen_llamada,fecha_registro&limit=1');
  if (segR.status >= 200 && segR.status < 300) {
    console.log(`\n  📋 seguimientos columnas nuevas: ${segR.data.substring(0, 200)}`);
  }

  console.log('\n════════════════════════════════════════════════════');
  console.log('  ✅ MIGRACIÓN 005 COMPLETADA');
  console.log('════════════════════════════════════════════════════\n');
}

main().catch(console.error);
