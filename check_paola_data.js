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
  await execSQL('Check Paola', `
    TRUNCATE TABLE temp_logs;
    INSERT INTO temp_logs (msg)
    SELECT 'CLIENT: ' || nombre_completo || ' (' || whatsapp || ')'
    FROM public.clientes
    WHERE nombre_completo ILIKE '%PAOLA%' OR whatsapp = '+573183542883';

    INSERT INTO temp_logs (msg)
    SELECT 'SEG: ' || id || ' for ' || whatsapp
    FROM public.seguimientos_fidelizacion
    WHERE whatsapp = '+573183542883';
    
    INSERT INTO temp_logs (msg)
    SELECT 'INT: ' || id || ' type ' || tipo || ' result ' || resultado
    FROM public.interacciones
    WHERE whatsapp = '+573183542883';
  `);
}
main().catch(console.error);
