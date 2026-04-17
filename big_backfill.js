const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }};
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('Running Big Backfill...');
  const res = await execSQL('Backfill', `
    -- 1. Crear seguimientos para todos los clientes faltantes
    INSERT INTO public.seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad, created_at)
    SELECT DISTINCT whatsapp, 'ACTIVA', 'ALTA', now()
    FROM public.clientes
    WHERE whatsapp IS NOT NULL 
    AND whatsapp NOT IN (SELECT whatsapp FROM public.seguimientos_fidelizacion);

    -- 2. Vincular cliente_id
    UPDATE public.seguimientos_fidelizacion s
    SET cliente_id = c.id
    FROM public.clientes c
    WHERE s.whatsapp = c.whatsapp AND s.cliente_id IS NULL;
    
    -- 3. Limpiar registros basura (si existen duplicados por whatsapp)
    -- Mantener solo el más reciente por whatsapp si hay duplicados
    DELETE FROM public.seguimientos_fidelizacion
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY whatsapp ORDER BY created_at DESC) as rn
        FROM public.seguimientos_fidelizacion
      ) t WHERE t.rn = 1
    );
  `);
  console.log('Result:', res);
}
main().catch(console.error);
