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
  console.log('Running Big Backfill (WhatsApp-only)...');
  const res = await execSQL('Backfill', `
    -- Crear seguimientos para todos los clientes faltantes usando whatsapp como llave
    INSERT INTO public.seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad, created_at)
    SELECT DISTINCT whatsapp, 'ACTIVA', 'ALTA', now()
    FROM public.clientes
    WHERE whatsapp IS NOT NULL 
    AND whatsapp NOT IN (SELECT whatsapp FROM public.seguimientos_fidelizacion);
  `);
  console.log('Result:', res);
}
main().catch(console.error);
