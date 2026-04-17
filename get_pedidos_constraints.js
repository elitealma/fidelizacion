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
  await execSQL('Log Pedidos Constraints', `
    TRUNCATE TABLE public.temp_logs;
    INSERT INTO public.temp_logs (msg)
    SELECT 
        conname || ' on ' || relname || ' referencing ' || confrelid::regclass || '(' || a.attname || ')'
    FROM 
        pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        JOIN pg_class TABLE_NAME ON TABLE_NAME.oid = c.conrelid
    WHERE 
        relname = 'pedidos';
  `);
}
main().catch(console.error);
