const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = {
      hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        let ok = res.statusCode >= 200 && res.statusCode < 300;
        let parsed; try { parsed = JSON.parse(d); } catch(e) { parsed = null; }
        if (ok && parsed && parsed.success === false) console.log(`  ⚠️  ${label}: ${parsed.error}`);
        else if (ok) console.log(`  ✅ ${label}`);
        else console.log(`  ❌ ${label} (${res.statusCode}): ${d.substring(0, 150)}`);
        resolve({ ok, data: parsed || d });
      });
    });
    req.on('error', e => { console.log(`  ❌ ${label}: ${e.message}`); resolve({ ok: false }); });
    req.write(body); req.end();
  });
}

function restGet(path) {
  return new Promise((resolve) => {
    const opts = { hostname: HOST, path, method: 'GET', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` } };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve([]); } });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  MIGRACIÓN 006: whatsapp como campo relacionador');
  console.log('  en pedidos, seguimientos_fidelizacion, interacciones');
  console.log('════════════════════════════════════════════════════════════\n');

  // ── 1. Agregar columna whatsapp a las tablas que no la tienen ──
  console.log('── [1] Agregar columna whatsapp TEXT ──');
  await execSQL('pedidos.whatsapp', "ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS whatsapp TEXT;");
  await execSQL('seguimientos.whatsapp', "ALTER TABLE public.seguimientos_fidelizacion ADD COLUMN IF NOT EXISTS whatsapp TEXT;");
  await execSQL('interacciones.whatsapp', "ALTER TABLE public.interacciones ADD COLUMN IF NOT EXISTS whatsapp TEXT;");

  // ── 2. Crear índice en whatsapp para búsquedas rápidas ──
  console.log('\n── [2] Índices en whatsapp ──');
  await execSQL('Idx pedidos.whatsapp', "CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp ON public.pedidos (whatsapp);");
  await execSQL('Idx seg.whatsapp', "CREATE INDEX IF NOT EXISTS idx_seguimientos_whatsapp ON public.seguimientos_fidelizacion (whatsapp);");
  await execSQL('Idx inter.whatsapp', "CREATE INDEX IF NOT EXISTS idx_interacciones_whatsapp ON public.interacciones (whatsapp);");

  // ── 3. Llenar whatsapp en registros existentes desde clientes ──
  console.log('\n── [3] Llenar whatsapp en registros existentes ──');
  
  // pedidos: tomar whatsapp del cliente relacionado
  await execSQL('Fill pedidos.whatsapp', `
    UPDATE public.pedidos p
    SET whatsapp = c.whatsapp
    FROM public.clientes c
    WHERE p.cliente_id = c.id
    AND p.whatsapp IS NULL;
  `);

  // seguimientos: tomar whatsapp via pedido → cliente
  await execSQL('Fill seguimientos.whatsapp', `
    UPDATE public.seguimientos_fidelizacion s
    SET whatsapp = c.whatsapp
    FROM public.pedidos p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE s.pedido_id = p.id
    AND s.whatsapp IS NULL;
  `);

  // interacciones: tomar whatsapp via seguimiento → pedido → cliente
  await execSQL('Fill interacciones.whatsapp', `
    UPDATE public.interacciones i
    SET whatsapp = c.whatsapp
    FROM public.seguimientos_fidelizacion s
    JOIN public.pedidos p ON s.pedido_id = p.id
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE i.seguimiento_id = s.id
    AND i.whatsapp IS NULL;
  `);

  // ── 4. Verificación ──
  console.log('\n── [4] Verificación ──');
  const tables = ['clientes', 'pedidos', 'seguimientos_fidelizacion', 'interacciones'];
  for (const t of tables) {
    const rows = await restGet(`/rest/v1/${t}?select=id,whatsapp&limit=3`);
    if (Array.isArray(rows) && rows.length > 0) {
      const filled = rows.filter(r => r.whatsapp).length;
      console.log(`  ✅ ${t}: ${filled}/${rows.length} tienen whatsapp → "${rows[0].whatsapp || 'null'}"`);
    } else {
      console.log(`  ℹ️  ${t}: sin registros`);
    }
  }

  // ── 5. Mostrar ejemplo de búsqueda por whatsapp ──
  console.log('\n── [5] Ejemplo: buscar todo por +573001234567 ──');
  const testPhone = '+573001234567';
  
  const c = await restGet(`/rest/v1/clientes?whatsapp=eq.${encodeURIComponent(testPhone)}&select=id,nombre_completo,whatsapp,etiqueta&limit=1`);
  if (c.length) console.log(`  📋 Cliente: ${c[0].nombre_completo} (${c[0].etiqueta})`);
  
  const p = await restGet(`/rest/v1/pedidos?whatsapp=eq.${encodeURIComponent(testPhone)}&select=id,producto,ticket_compra,whatsapp&limit=5`);
  console.log(`  📦 Pedidos: ${p.length} encontrados`);
  p.forEach(r => console.log(`     → ${r.producto} · $${r.ticket_compra}`));
  
  const s = await restGet(`/rest/v1/seguimientos_fidelizacion?whatsapp=eq.${encodeURIComponent(testPhone)}&select=id,prioridad,estado_tarea,whatsapp&limit=5`);
  console.log(`  📌 Seguimientos: ${s.length} encontrados`);
  
  const i = await restGet(`/rest/v1/interacciones?whatsapp=eq.${encodeURIComponent(testPhone)}&select=id,tipo,resultado,whatsapp&limit=5`);
  console.log(`  📞 Interacciones: ${i.length} encontradas`);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  ✅ MIGRACIÓN 006 COMPLETADA');
  console.log('');
  console.log('  Ahora puedes consultar CUALQUIER tabla por whatsapp:');
  console.log('  GET /rest/v1/pedidos?whatsapp=eq.+573001234567');
  console.log('  GET /rest/v1/seguimientos_fidelizacion?whatsapp=eq.+573001234567');
  console.log('  GET /rest/v1/interacciones?whatsapp=eq.+573001234567');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
