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
  console.log('Final Database Repair...');
  
  await execSQL('Delete All New FKs', `
    DO $$ 
    BEGIN 
        -- Drop all extra FKs added for whatsapp to resolve PostgREST ambiguity
        EXECUTE (
            SELECT 'ALTER TABLE ' || table_schema || '.' || table_name || ' DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE constraint_name IN ('fk_pedido_wa', 'fk_seguimiento_wa', 'fk_interacciones_wa', 'fk_pedidos_whatsapp', 'fk_seguimiento_whatsapp', 'fk_interacciones_whatsapp', 'pedidos_whatsapp_fkey')
        );
    EXCEPTION WHEN OTHERS THEN 
        -- Ignorar si no existen
    END $$;
  `);

  await execSQL('Reload', "NOTIFY pgrst, 'reload schema';");
  console.log('Done.');
}
main().catch(console.error);
