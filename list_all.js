const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function getTable(name) {
  return new Promise((resolve) => {
    const opts = { hostname: HOST, path: `/rest/v1/${name}?select=*`, method: 'GET', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }};
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
}

async function main() {
  const segs = await getTable('seguimientos_fidelizacion');
  console.log('--- ALL SEGUIMIENTOS ---');
  segs.forEach(s => console.log(`${s.id} | WA: ${s.whatsapp} | E: ${s.estado_tarea}`));
}
main().catch(console.error);
