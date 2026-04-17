const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }};
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('Resolving PGRST201 Ambuiguity...');
  
  // Eliminamos las FKs redundantes que causan ambigüedad en PostgREST
  // Pero mantenemos los índices para velocidad de consulta
  
  await execSQL('Drop FKs', `
    -- En pedidos
    ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS fk_pedidos_whatsapp;
    ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_whatsapp_fkey;
    
    -- En seguimientos
    ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS fk_seguimiento_whatsapp;
    ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS fk_seguimiento_wa;
    
    -- En interacciones (aqui no hay ambigüedad porque no hay otro enlace, 
    -- pero para ser consistentes y evitar futuros problemas con joins inversos)
    ALTER TABLE public.interacciones DROP CONSTRAINT IF EXISTS fk_interacciones_whatsapp;
  `);

  console.log('Ambiguity resolved. Web should work now.');
}
main().catch(console.error);
