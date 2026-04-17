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
  console.log('Purging test data...');
  const res = await execSQL('Purge', `
    -- 1. Eliminar seguimientos de clientes de prueba
    DELETE FROM public.seguimientos_fidelizacion
    WHERE whatsapp IN (SELECT whatsapp FROM public.clientes WHERE nombre_completo ILIKE '%prueba%');
    
    -- 2. Eliminar clientes de prueba
    DELETE FROM public.clientes WHERE nombre_completo ILIKE '%prueba%';
    
    -- 3. Eliminar interacciones de prueba
    DELETE FROM public.interacciones WHERE resumen_llamada ILIKE '%prueba%';
  `);
  console.log('Result:', res);
}
main().catch(console.error);
