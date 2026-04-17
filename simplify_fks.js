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
  console.log('Simplifying Foreign Keys...');
  const res = await execSQL('Simplify', `
    -- 1. Eliminar la FK ambigua (la que usa cliente_id que no existe o está vacía)
    ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS fk_seguimientos_clientes;
    
    -- 2. Asegurar que la FK directa por whatsapp sea la ÚNICA y se llame simplemente 'clientes'
    -- Primero la borramos si existe con otro nombre
    ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS fk_seguimientos_clientes_direct;
    
    -- La creamos con el nombre estándar que Supabase prefiere para joins limpios
    ALTER TABLE public.seguimientos_fidelizacion 
    ADD CONSTRAINT seguimientos_fidelizacion_whatsapp_fkey 
    FOREIGN KEY (whatsapp) REFERENCES public.clientes(whatsapp);
  `);
  console.log('Result:', res);
}
main().catch(console.error);
