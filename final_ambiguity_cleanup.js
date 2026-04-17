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
  console.log('Final Ambiguity Cleanup...');
  
  await execSQL('Drop All WA FKs', `
    DO $$ 
    BEGIN 
        -- Pedidos
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pedido_wa') THEN
            ALTER TABLE public.pedidos DROP CONSTRAINT fk_pedido_wa;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_whatsapp_fkey') THEN
            ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_whatsapp_fkey;
        END IF;
        
        -- Seguimientos
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_seguimiento_wa') THEN
            ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT fk_seguimiento_wa;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguimientos_fidelizacion_whatsapp_fkey') THEN
            ALTER TABLE public.seguimientos_fidelizacion DROP CONSTRAINT seguimientos_fidelizacion_whatsapp_fkey;
        END IF;
        
        -- Interacciones
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interacciones_whatsapp') THEN
            ALTER TABLE public.interacciones DROP CONSTRAINT fk_interacciones_whatsapp;
        END IF;
    END $$;
  `);

  console.log('Cleanup done. Re-checking logs...');
}
main().catch(console.error);
