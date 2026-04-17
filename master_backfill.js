const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function execSQL(sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const opts = { hostname: HOST, path: '/rest/v1/rpc/exec_sql', method: 'POST', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }};
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.write(body); req.end();
  });
}

async function main() {
  console.log('Master Backfill...');
  // 1. Mark all interactions with a seguimiento_id if they dont have one
  await execSQL(`
    WITH latest_segs AS (
      SELECT DISTINCT ON (whatsapp) whatsapp, id
      FROM seguimientos_fidelizacion
      ORDER BY whatsapp, created_at DESC
    )
    UPDATE interacciones i
    SET seguimiento_id = ls.id
    FROM latest_segs ls
    WHERE i.whatsapp = ls.whatsapp AND i.seguimiento_id IS NULL;
  `);
  
  // 2. Ensure all clients have at least one seguimiento
  await execSQL(`
    INSERT INTO seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad)
    SELECT whatsapp, 'ACTIVA', 'MEDIA'
    FROM clientes
    WHERE whatsapp NOT IN (SELECT whatsapp FROM seguimientos_fidelizacion);
  `);
  
  console.log('Done.');
}
main().catch(console.error);
