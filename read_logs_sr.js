const https = require('https');
const HOST = 'rqucbsuafirnohhogdry.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWNic3VhZmlybm9oaG9nZHJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTgyNCwiZXhwIjoyMDkwNjQ3ODI0fQ.YAgCpKIkE1c2CQXmFlZBcwpC7CKcf0fAn7QeW7D8dnM';

function fetchSR() {
  const url = `https://${HOST}/rest/v1/temp_logs?select=*&order=id.desc&limit=10`;
  https.get(url, { headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY } }, (res) => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => console.log('Logs Result:', d));
  });
}

fetchSR();
